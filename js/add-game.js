import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://pedtyonlklzbyikiywru.supabase.co'
const supabaseKey = 'sb_publishable_oLffRxc_yv8J4ZDTuSSPXw_wQtNye15'
const GAME_TABLE = 'Game'
const IMAGE_BUCKET = 'game-image'

const supabase = createClient(supabaseUrl, supabaseKey)

const form = document.getElementById('gameLibraryForm')
const imageInput = document.getElementById('imgInp')
const imageFileNameInput = document.querySelector('input[name="img"]')

if (!form) {
	throw new Error('Form #gameLibraryForm not found in add-game.html')
}

function parseNumber(value) {
	if (value === null || value === undefined || value === '') {
		return null
	}

	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

function parseInteger(value) {
	const parsed = parseNumber(value)
	return parsed === null ? null : Math.trunc(parsed)
}

function parseIdArray(csvValue) {
	return String(csvValue || '')
		.split(',')
		.map((value) => Number(value.trim()))
		.filter((value) => Number.isInteger(value))
}

function sanitizeFilename(fileName) {
	return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function uploadImageIfSelected() {
	if (!imageInput || !imageInput.files || !imageInput.files.length) {
		return null
	}

	const file = imageInput.files[0]
	const timestamp = Date.now()
	const safeFileName = sanitizeFilename(file.name)
	const filePath = `games/${timestamp}-${safeFileName}`

	const { data, error } = await supabase.storage
		.from(IMAGE_BUCKET)
		.upload(filePath, file, {
			upsert: false,
			contentType: file.type || 'application/octet-stream'
		})

	if (error) {
		throw new Error(`Image upload failed: ${error.message}`)
	}

	return data.path
}

function buildGamePayload(formData, imagePath) {
	const expansionValue = String(formData.get('expansion_or_base') || '')
	let expansion = null
	if (expansionValue === 'Expansion') {
		expansion = true
	}
	if (expansionValue === 'Base Game') {
		expansion = false
	}

	const payload = {
		name: String(formData.get('name') || '').trim(),
		players_min: parseInteger(formData.get('players_min')),
		players_max: parseInteger(formData.get('players_max')),
		owner: String(formData.get('owner') || '').trim() || null,
		hours_min: parseNumber(formData.get('game_hours_min')),
		hours_max: parseNumber(formData.get('game_hours_max')),
		year_published: parseInteger(formData.get('year_published')),
		game_complexity: String(formData.get('game_complexity') || '').trim() || null,
		recommended_age: parseInteger(formData.get('recommended_age')),
		expansion,
		condition: String(formData.get('condition_status') || '').trim() || null,
		language: String(formData.get('language') || '').trim() || null,
		game_designer: String(formData.get('game_designer') || '').trim() || null,
		publisher: String(formData.get('publisher') || '').trim() || null,
		web_url: String(formData.get('game_website') || '').trim() || null,
		tags: parseIdArray(formData.get('tags')),
		theme: parseIdArray(formData.get('theme')),
		mechanics: parseIdArray(formData.get('game_mechanisms')),
		image_path: imagePath || String(formData.get('game_image') || '').trim() || null
	}

	return payload
}

async function submitGame(event) {
	event.preventDefault()

	const submitButton = form.querySelector('button[type="submit"]')
	if (submitButton) {
		submitButton.disabled = true
		submitButton.textContent = 'Saving...'
	}

	try {
		const formData = new FormData(form)
		const imagePath = await uploadImageIfSelected()
		const payload = buildGamePayload(formData, imagePath)

		const { error } = await supabase
			.from(GAME_TABLE)
			.insert([payload])

		if (error) {
			throw new Error(`Game insert failed: ${error.message}`)
		}

		window.alert('Game saved successfully.')
		form.reset()
		form.dispatchEvent(new CustomEvent('picker:clear'))

		// Clear file name mirror input after successful reset.
		if (imageFileNameInput) {
			imageFileNameInput.value = ''
		}
	} catch (error) {
		console.error(error)
		window.alert(error instanceof Error ? error.message : 'Failed to save game.')
	} finally {
		if (submitButton) {
			submitButton.disabled = false
			submitButton.textContent = 'Save Game'
		}
	}
}

if (imageInput && imageFileNameInput) {
	imageInput.addEventListener('change', () => {
		const fileName = imageInput.files && imageInput.files[0] ? imageInput.files[0].name : ''
		imageFileNameInput.value = fileName
	})
}

form.addEventListener('submit', submitGame)
