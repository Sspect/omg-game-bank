import { supabase, supabaseUrl } from './supabase.js'
import {
	buildGamePayload,
	CARD_IMAGE_PATH_PREFIX,
	clearImagePreview,
	BOX_IMAGE_PATH_PREFIX,
	GAME_TABLE,
	toPublicImageUrl,
	uploadImageIfSelected,
	updateImagePreview
} from './game-form-utils.js'

const form = document.getElementById('gameLibraryForm')
const cardImageInput = document.getElementById('cardImgInp')
const cardImageFileNameInput = document.querySelector('input[name="card_img"]')
const cardImagePreview = document.getElementById('card-img-upload')
const boxImageInput = document.getElementById('boxImgInp')
const boxImageFileNameInput = document.querySelector('input[name="box_img"]')
const boxImagePreview = document.getElementById('box-img-upload')

const queryParams = new URLSearchParams(window.location.search)
const gameId = Number(queryParams.get('id'))

let existingGame = null
let cardImagePreviewUrl = null
let boxImagePreviewUrl = null

const cardImagePreviewState = {
	get value() {
		return cardImagePreviewUrl
	},
	set value(newValue) {
		cardImagePreviewUrl = newValue
	}
}

const boxImagePreviewState = {
	get value() {
		return boxImagePreviewUrl
	},
	set value(newValue) {
		boxImagePreviewUrl = newValue
	}
}

if (!form) {
	throw new Error('Form #gameLibraryForm not found in edit-game.html')
}

function normalizeIdList(value) {
	if (Array.isArray(value)) {
		return value
			.map((id) => Number(id))
			.filter((id) => Number.isInteger(id))
	}

	if (typeof value === 'string') {
		const trimmed = value.trim()
		if (!trimmed) {
			return []
		}

		try {
			const parsed = JSON.parse(trimmed)
			if (Array.isArray(parsed)) {
				return parsed
					.map((id) => Number(id))
					.filter((id) => Number.isInteger(id))
			}
		} catch {
			return trimmed
				.split(',')
				.map((id) => Number(id.trim()))
				.filter((id) => Number.isInteger(id))
		}
	}

	return []
}

function setInputValue(inputId, value) {
	const input = document.getElementById(inputId)
	if (!input) {
		return
	}

	input.value = value ?? ''
}

function setExpansionValue(expansion) {
	if (expansion === true) {
		setInputValue('expansion_or_base', 'Expansion')
		return
	}

	if (expansion === false) {
		setInputValue('expansion_or_base', 'Base Game')
		return
	}

	setInputValue('expansion_or_base', '')
}

function showExistingImagePreview(imagePath, imagePreviewElement, fileNameInput, previewUrlState) {
	clearImagePreview(imagePreviewElement, previewUrlState)

	if (!imagePath) {
		if (fileNameInput) {
			fileNameInput.value = ''
		}
		return
	}

	const publicUrl = toPublicImageUrl(supabaseUrl, imagePath)
	if (!publicUrl) {
		if (fileNameInput) {
			fileNameInput.value = ''
		}
		return
	}

	if (fileNameInput) {
		const normalizedPath = String(imagePath)
		const fileName = normalizedPath.split('/').pop() || normalizedPath
		fileNameInput.value = fileName
	}

	if (imagePreviewElement) {
		imagePreviewElement.src = publicUrl
		imagePreviewElement.classList.remove('d-none')
	}
}

function populateForm(existingRow) {
	setInputValue('name', existingRow.name)
	setInputValue('owner', existingRow.owner)
	setInputValue('players_min', existingRow.players_min)
	setInputValue('players_max', existingRow.players_max)
	setInputValue('game_hours_min', existingRow.hours_min)
	setInputValue('game_hours_max', existingRow.hours_max)
	setInputValue('year_published', existingRow.year_published)
	setInputValue('game_complexity', existingRow.game_complexity)
	setInputValue('recommended_age', existingRow.recommended_age)
	setExpansionValue(existingRow.expansion)
	setInputValue('condition_status', existingRow.condition)
	setInputValue('language', existingRow.language)
	setInputValue('game_designer', existingRow.game_designer)
	setInputValue('publisher', existingRow.publisher)
	setInputValue('description', existingRow.description)
	setInputValue('game_more_info', existingRow.more_info)

	const tags = normalizeIdList(existingRow.tags)
	const theme = normalizeIdList(existingRow.theme)
	const mechanics = normalizeIdList(existingRow.mechanics)

	setInputValue('tags', tags.join(','))
	setInputValue('theme', theme.join(','))
	setInputValue('game_mechanics', mechanics.join(','))

	form.dispatchEvent(new CustomEvent('picker:prefill', {
		detail: {
			tags,
			theme,
			mechanics
		}
	}))

	showExistingImagePreview(existingRow.card_image_path, cardImagePreview, cardImageFileNameInput, cardImagePreviewState)
	showExistingImagePreview(existingRow.box_image_path, boxImagePreview, boxImageFileNameInput, boxImagePreviewState)
}

function setFormEnabled(isEnabled) {
	Array.from(form.elements).forEach((element) => {
		if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement || element instanceof HTMLButtonElement)) {
			return
		}

		element.disabled = !isEnabled
	})
}

async function loadExistingGame() {
	if (!Number.isInteger(gameId) || gameId <= 0) {
		window.alert('Missing or invalid game id in URL. Open edit page from a game card.')
		setFormEnabled(false)
		return
	}

	setFormEnabled(false)

	const { data, error } = await supabase
		.from(GAME_TABLE)
		.select('*')
		.eq('id', gameId)
		.single()

	if (error) {
		console.error(error)
		window.alert(`Failed to load game: ${error.message}`)
		return
	}

	existingGame = data
	populateForm(existingGame)
	setFormEnabled(true)
}

async function uploadCardImageIfSelected() {
	return uploadImageIfSelected(supabase, cardImageInput, CARD_IMAGE_PATH_PREFIX, 'Card image')
}

async function uploadBoxImageIfSelected() {
	return uploadImageIfSelected(supabase, boxImageInput, BOX_IMAGE_PATH_PREFIX, 'Box image')
}

async function submitEdit(event) {
	event.preventDefault()

	if (!existingGame) {
		window.alert('Game data is not loaded yet.')
		return
	}

	const submitButton = form.querySelector('button[type="submit"]')
	if (submitButton) {
		submitButton.disabled = true
		submitButton.textContent = 'Saving...'
	}

	try {
		const formData = new FormData(form)
		const uploadedCardImagePath = await uploadCardImageIfSelected()
		const uploadedBoxImagePath = await uploadBoxImageIfSelected()

		const cardImagePath = uploadedCardImagePath || existingGame.card_image_path || null
		const boxImagePath = uploadedBoxImagePath || existingGame.box_image_path || null

		const payload = buildGamePayload(formData, cardImagePath, boxImagePath)

		const { error } = await supabase
			.from(GAME_TABLE)
			.update(payload)
			.eq('id', gameId)

		if (error) {
			throw new Error(`Game update failed: ${error.message}`)
		}

		existingGame = {
			...existingGame,
			...payload
		}

		if (uploadedCardImagePath) {
			showExistingImagePreview(uploadedCardImagePath, cardImagePreview, cardImageFileNameInput, cardImagePreviewState)
		}

		if (uploadedBoxImagePath) {
			showExistingImagePreview(uploadedBoxImagePath, boxImagePreview, boxImageFileNameInput, boxImagePreviewState)
		}

		window.alert('Game updated successfully.')
	} catch (error) {
		console.error(error)
		window.alert(error instanceof Error ? error.message : 'Failed to update game.')
	} finally {
		if (submitButton) {
			submitButton.disabled = false
			submitButton.textContent = 'Update Game'
		}
	}
}

if (cardImageInput && cardImageFileNameInput) {
	cardImageInput.addEventListener('change', () => {
		const selectedFile = cardImageInput.files && cardImageInput.files[0] ? cardImageInput.files[0] : null
		const fileName = selectedFile ? selectedFile.name : ''
		cardImageFileNameInput.value = fileName
		updateImagePreview(selectedFile, cardImagePreview, cardImagePreviewState)
	})
}

if (boxImageInput && boxImageFileNameInput) {
	boxImageInput.addEventListener('change', () => {
		const selectedFile = boxImageInput.files && boxImageInput.files[0] ? boxImageInput.files[0] : null
		const fileName = selectedFile ? selectedFile.name : ''
		boxImageFileNameInput.value = fileName
		updateImagePreview(selectedFile, boxImagePreview, boxImagePreviewState)
	})
}

form.addEventListener('submit', submitEdit)
void loadExistingGame()