import { supabase } from './supabase.js'

const VIBES_TABLE = 'Vibes'

const vibeSearchInput = document.getElementById('vibeSearchInput')
const vibeDropdown = document.getElementById('vibeDropdown')
const selectedVibesContainer = document.getElementById('selectedVibes')
const vibesHiddenInput = document.getElementById('vibes') || document.getElementById('tags')
const vibePicker = document.getElementById('vibePicker')

if (!vibeSearchInput || !vibeDropdown || !selectedVibesContainer || !vibesHiddenInput || !vibePicker) {
	throw new Error('Vibe picker elements not found in add-game.html')
}

let allVibes = []
let selectedVibes = []
let detectedNameColumn = null
let detectedIdColumn = null
let pendingPrefillVibeIds = []

function normalizeVibe(value) {
	return String(value ?? '').trim()
}

function normalizeVibeKey(value) {
	return normalizeVibe(value).toLowerCase()
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

		return trimmed
			.split(',')
			.map((id) => Number(id.trim()))
			.filter((id) => Number.isInteger(id))
	}

	return []
}

function getCandidateNameColumns() {
	const defaults = ['name', 'vibe', 'vibe_name', 'title', 'label']
	return detectedNameColumn ? [detectedNameColumn, ...defaults.filter((col) => col !== detectedNameColumn)] : defaults
}

function getCandidateIdColumns() {
	const defaults = ['id', 'vibe_id', 'uuid']
	return detectedIdColumn ? [detectedIdColumn, ...defaults.filter((col) => col !== detectedIdColumn)] : defaults
}

function extractVibeName(row) {
	if (!row || typeof row !== 'object') {
		return ''
	}

	const preferredColumns = getCandidateNameColumns()
	for (const column of preferredColumns) {
		if (row[column]) {
			detectedNameColumn = column
			return normalizeVibe(row[column])
		}
	}

	const fallbackValue = Object.values(row).find((value) => typeof value === 'string' && normalizeVibe(value))
	return normalizeVibe(fallbackValue)
}

function extractVibeId(row) {
	if (!row || typeof row !== 'object') {
		return null
	}

	const preferredColumns = getCandidateIdColumns()
	for (const column of preferredColumns) {
		if (row[column] !== undefined && row[column] !== null) {
			detectedIdColumn = column
			return row[column]
		}
	}

	return null
}

function updateHiddenInput() {
	vibesHiddenInput.value = selectedVibes
		.map((vibe) => vibe.id)
		.filter((id) => id !== null && id !== undefined)
		.join(',')
}

function renderSelectedVibes() {
	selectedVibesContainer.innerHTML = ''

	selectedVibes.forEach((vibe) => {
		const badge = document.createElement('span')
		badge.className = 'badge text-bg-primary d-inline-flex align-items-center gap-1 px-2 py-1'
		badge.textContent = vibe.name

		const removeButton = document.createElement('button')
		removeButton.type = 'button'
		removeButton.className = 'btn-close btn-close-white btn-sm ms-1'
		removeButton.ariaLabel = `Remove ${vibe.name}`
		removeButton.addEventListener('click', () => {
			selectedVibes = selectedVibes.filter((selectedVibe) => normalizeVibeKey(selectedVibe.name) !== normalizeVibeKey(vibe.name))
			renderSelectedVibes()
			renderDropdown(vibeSearchInput.value)
		})

		badge.appendChild(removeButton)
		selectedVibesContainer.appendChild(badge)
	})

	updateHiddenInput()
}

function applyPrefillIfReady() {
	if (!pendingPrefillVibeIds.length || !allVibes.length) {
		return
	}

	const pendingIds = new Set(pendingPrefillVibeIds)
	selectedVibes = allVibes.filter((vibe) => pendingIds.has(Number(vibe.id)))
	pendingPrefillVibeIds = []
	renderSelectedVibes()
	renderDropdown(vibeSearchInput.value)
}

function openDropdown() {
	vibeDropdown.classList.remove('d-none')
}

function closeDropdown() {
	vibeDropdown.classList.add('d-none')
}

function isSelected(vibeName) {
	const key = normalizeVibeKey(vibeName)
	return selectedVibes.some((vibe) => normalizeVibeKey(vibe.name) === key)
}

function setStatusRow(message, styleClass = 'text-body-secondary') {
	vibeDropdown.innerHTML = ''
	const statusRow = document.createElement('div')
	statusRow.className = `list-group-item ${styleClass}`
	statusRow.textContent = message
	vibeDropdown.appendChild(statusRow)
	openDropdown()
}

async function loadVibes() {
	const { data, error } = await supabase
		.from(VIBES_TABLE)
		.select('*')

	if (error) {
		console.error('Failed to load vibes:', error)
		setStatusRow('Could not load vibes from the database.', 'text-danger')
		return
	}

	const seen = new Set()
	allVibes = (data || [])
		.map((row) => {
			const name = extractVibeName(row)
			return {
				id: extractVibeId(row),
				name
			}
		})
		.filter((vibe) => {
			const key = normalizeVibeKey(vibe.name)
			if (!key || seen.has(key)) {
				return false
			}
			seen.add(key)
			return true
		})
		.sort((a, b) => a.name.localeCompare(b.name))

	applyPrefillIfReady()
	renderDropdown(vibeSearchInput.value)
}

function renderDropdown(query = '') {
	const trimmedQuery = normalizeVibe(query)
	const queryKey = normalizeVibeKey(trimmedQuery)

	vibeDropdown.innerHTML = ''

	const filteredVibes = allVibes.filter((vibe) => {
		const vibeKey = normalizeVibeKey(vibe.name)
		const matchesQuery = !queryKey || vibeKey.includes(queryKey)
		return matchesQuery && !isSelected(vibe.name)
	})

	filteredVibes.forEach((vibe) => {
		const row = document.createElement('div')
		row.className = 'list-group-item d-flex justify-content-between align-items-center'

		const selectButton = document.createElement('button')
		selectButton.type = 'button'
		selectButton.className = 'btn btn-sm btn-outline-secondary flex-grow-1 text-start'
		selectButton.textContent = vibe.name
		selectButton.addEventListener('click', () => {
			selectedVibes.push(vibe)
			vibeSearchInput.value = ''
			renderSelectedVibes()
			renderDropdown('')
			vibeSearchInput.focus()
		})

		const deleteButton = document.createElement('button')
		deleteButton.type = 'button'
		deleteButton.className = 'btn btn-sm btn-outline-danger ms-2'
		deleteButton.textContent = 'Delete'
		deleteButton.addEventListener('click', async (event) => {
			event.stopPropagation()
			await deleteVibe(vibe)
		})

		row.appendChild(selectButton)
		row.appendChild(deleteButton)
		vibeDropdown.appendChild(row)
	})

	const hasExactMatch = allVibes.some((vibe) => normalizeVibeKey(vibe.name) === queryKey)

	if (trimmedQuery && !hasExactMatch) {
		const createButton = document.createElement('button')
		createButton.type = 'button'
		createButton.className = 'list-group-item list-group-item-action text-success fw-semibold'
		createButton.textContent = `Create new vibe: "${trimmedQuery}"`
		createButton.addEventListener('click', async () => {
			await createVibe(trimmedQuery)
		})
		vibeDropdown.appendChild(createButton)
	}

	if (!vibeDropdown.children.length) {
		const emptyState = document.createElement('div')
		emptyState.className = 'list-group-item text-body-secondary'
		emptyState.textContent = trimmedQuery ? 'No matching vibes.' : 'No vibes available.'
		vibeDropdown.appendChild(emptyState)
	}

	openDropdown()
}

async function createVibe(vibeName) {
	const normalizedName = normalizeVibe(vibeName)
	if (!normalizedName) {
		return
	}

	const existingVibe = allVibes.find((vibe) => normalizeVibeKey(vibe.name) === normalizeVibeKey(normalizedName))
	if (existingVibe) {
		if (!isSelected(existingVibe.name)) {
			selectedVibes.push(existingVibe)
			renderSelectedVibes()
		}
		vibeSearchInput.value = ''
		renderDropdown('')
		return
	}

	const nameColumns = getCandidateNameColumns()
	let createdVibe = null
	let lastError = null

	for (const column of nameColumns) {
		const payload = {
			[column]: normalizedName
		}
		const { data, error } = await supabase
			.from(VIBES_TABLE)
			.insert([payload])
			.select('*')
			.single()

		if (!error && data) {
			detectedNameColumn = column
			createdVibe = {
				id: extractVibeId(data),
				name: extractVibeName(data)
			}
			break
		}

		lastError = error
	}

	if (!createdVibe) {
		console.error('Failed to create vibe:', lastError)
		setStatusRow('Could not create vibe in the database.', 'text-danger')
		return
	}

	allVibes.push(createdVibe)
	allVibes.sort((a, b) => a.name.localeCompare(b.name))
	selectedVibes.push(createdVibe)
	vibeSearchInput.value = ''
	renderSelectedVibes()
	renderDropdown('')
}

async function deleteVibe(vibe) {
	const confirmed = window.confirm(`Delete vibe "${vibe.name}" from the database?`)
	if (!confirmed) {
		return
	}

	let success = false
	let lastError = null

	if (vibe.id !== null && vibe.id !== undefined) {
		const idColumns = getCandidateIdColumns()
		for (const column of idColumns) {
			const { error } = await supabase
				.from(VIBES_TABLE)
				.delete()
				.eq(column, vibe.id)

			if (!error) {
				detectedIdColumn = column
				success = true
				break
			}

			lastError = error
		}
	}

	if (!success) {
		const nameColumns = getCandidateNameColumns()
		for (const column of nameColumns) {
			const { error } = await supabase
				.from(VIBES_TABLE)
				.delete()
				.eq(column, vibe.name)

			if (!error) {
				detectedNameColumn = column
				success = true
				break
			}

			lastError = error
		}
	}

	if (!success) {
		console.error('Failed to delete vibe:', lastError)
		setStatusRow('Could not delete the selected vibe.', 'text-danger')
		return
	}

	const removedKey = normalizeVibeKey(vibe.name)
	allVibes = allVibes.filter((storedVibe) => normalizeVibeKey(storedVibe.name) !== removedKey)
	selectedVibes = selectedVibes.filter((storedVibe) => normalizeVibeKey(storedVibe.name) !== removedKey)
	renderSelectedVibes()
	renderDropdown(vibeSearchInput.value)
}

vibeSearchInput.addEventListener('focus', () => {
	renderDropdown(vibeSearchInput.value)
})

vibeSearchInput.addEventListener('input', (event) => {
	renderDropdown(event.target.value)
})

vibeSearchInput.addEventListener('keydown', async (event) => {
	if (event.key === 'Enter') {
		event.preventDefault()
		const query = normalizeVibe(vibeSearchInput.value)
		if (query) {
			await createVibe(query)
		}
	}

	if (event.key === 'Escape') {
		closeDropdown()
	}
})

document.addEventListener('click', (event) => {
	if (!vibePicker.contains(event.target)) {
		closeDropdown()
	}
})

const form = document.getElementById('gameLibraryForm')
if (form) {
	form.addEventListener('picker:prefill', (event) => {
		const detail = event instanceof CustomEvent ? event.detail : null
		pendingPrefillVibeIds = normalizeIdList(detail?.vibes ?? detail?.tags)
		applyPrefillIfReady()
	})

	form.addEventListener('picker:clear', () => {
		selectedVibes = []
		pendingPrefillVibeIds = []
		renderSelectedVibes()
		vibeSearchInput.value = ''
		renderDropdown('')
	})
}

void loadVibes()