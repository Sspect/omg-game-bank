import { supabase } from './supabase.js'

const THEME_TABLE = 'Theme'

const themeSearchInput = document.getElementById('themeSearchInput')
const themeDropdown = document.getElementById('themeDropdown')
const selectedThemesContainer = document.getElementById('selectedThemes')
const themesHiddenInput = document.getElementById('theme')
const themePicker = document.getElementById('themePicker')

if (!themeSearchInput || !themeDropdown || !selectedThemesContainer || !themesHiddenInput || !themePicker) {
	throw new Error('Theme picker elements not found in add-game.html')
}

let allThemes = []
let selectedThemes = []
let detectedNameColumn = null
let detectedIdColumn = null
let pendingPrefillThemeIds = []

function normalizeTheme(value) {
	return String(value ?? '').trim()
}

function normalizeThemeKey(value) {
	return normalizeTheme(value).toLowerCase()
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
	const defaults = ['name', 'theme', 'theme_name', 'title', 'label']
	return detectedNameColumn ? [detectedNameColumn, ...defaults.filter((col) => col !== detectedNameColumn)] : defaults
}

function getCandidateIdColumns() {
	const defaults = ['id', 'theme_id', 'uuid']
	return detectedIdColumn ? [detectedIdColumn, ...defaults.filter((col) => col !== detectedIdColumn)] : defaults
}

function extractThemeName(row) {
	if (!row || typeof row !== 'object') {
		return ''
	}

	const preferredColumns = getCandidateNameColumns()
	for (const column of preferredColumns) {
		if (row[column]) {
			detectedNameColumn = column
			return normalizeTheme(row[column])
		}
	}

	const fallbackValue = Object.values(row).find((value) => typeof value === 'string' && normalizeTheme(value))
	return normalizeTheme(fallbackValue)
}

function extractThemeId(row) {
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
	themesHiddenInput.value = selectedThemes
		.map((theme) => theme.id)
		.filter((id) => id !== null && id !== undefined)
		.join(',')
}

function renderSelectedThemes() {
	selectedThemesContainer.innerHTML = ''

	selectedThemes.forEach((theme) => {
		const badge = document.createElement('span')
		badge.className = 'badge text-bg-primary d-inline-flex align-items-center gap-1 px-2 py-1'
		badge.textContent = theme.name

		const removeButton = document.createElement('button')
		removeButton.type = 'button'
		removeButton.className = 'btn-close btn-close-white btn-sm ms-1'
		removeButton.ariaLabel = `Remove ${theme.name}`
		removeButton.addEventListener('click', () => {
			selectedThemes = selectedThemes.filter((selectedTheme) => normalizeThemeKey(selectedTheme.name) !== normalizeThemeKey(theme.name))
			renderSelectedThemes()
			renderDropdown(themeSearchInput.value)
		})

		badge.appendChild(removeButton)
		selectedThemesContainer.appendChild(badge)
	})

	updateHiddenInput()
}

function applyPrefillIfReady() {
	if (!pendingPrefillThemeIds.length || !allThemes.length) {
		return
	}

	const pendingIds = new Set(pendingPrefillThemeIds)
	selectedThemes = allThemes.filter((theme) => pendingIds.has(Number(theme.id)))
	pendingPrefillThemeIds = []
	renderSelectedThemes()
	renderDropdown(themeSearchInput.value)
}

function openDropdown() {
	themeDropdown.classList.remove('d-none')
}

function closeDropdown() {
	themeDropdown.classList.add('d-none')
}

function isSelected(themeName) {
	const key = normalizeThemeKey(themeName)
	return selectedThemes.some((theme) => normalizeThemeKey(theme.name) === key)
}

function setStatusRow(message, styleClass = 'text-body-secondary') {
	themeDropdown.innerHTML = ''
	const statusRow = document.createElement('div')
	statusRow.className = `list-group-item ${styleClass}`
	statusRow.textContent = message
	themeDropdown.appendChild(statusRow)
	openDropdown()
}

async function loadThemes() {
	const { data, error } = await supabase
		.from(THEME_TABLE)
		.select('*')

	if (error) {
		console.error('Failed to load themes:', error)
		setStatusRow('Could not load themes from the database.', 'text-danger')
		return
	}

	const seen = new Set()
	allThemes = (data || [])
		.map((row) => {
			const name = extractThemeName(row)
			return {
				id: extractThemeId(row),
				name
			}
		})
		.filter((theme) => {
			const key = normalizeThemeKey(theme.name)
			if (!key || seen.has(key)) {
				return false
			}
			seen.add(key)
			return true
		})
		.sort((a, b) => a.name.localeCompare(b.name))

	applyPrefillIfReady()
	renderDropdown(themeSearchInput.value)
}

function renderDropdown(query = '') {
	const trimmedQuery = normalizeTheme(query)
	const queryKey = normalizeThemeKey(trimmedQuery)

	themeDropdown.innerHTML = ''

	const filteredThemes = allThemes.filter((theme) => {
		const themeKey = normalizeThemeKey(theme.name)
		const matchesQuery = !queryKey || themeKey.includes(queryKey)
		return matchesQuery && !isSelected(theme.name)
	})

	filteredThemes.forEach((theme) => {
		const row = document.createElement('div')
		row.className = 'list-group-item d-flex justify-content-between align-items-center'

		const selectButton = document.createElement('button')
		selectButton.type = 'button'
		selectButton.className = 'btn btn-sm btn-outline-secondary flex-grow-1 text-start'
		selectButton.textContent = theme.name
		selectButton.addEventListener('click', () => {
			selectedThemes.push(theme)
			themeSearchInput.value = ''
			renderSelectedThemes()
			renderDropdown('')
			themeSearchInput.focus()
		})

		const deleteButton = document.createElement('button')
		deleteButton.type = 'button'
		deleteButton.className = 'btn btn-sm btn-outline-danger ms-2'
		deleteButton.textContent = 'Delete'
		deleteButton.addEventListener('click', async (event) => {
			event.stopPropagation()
			await deleteTheme(theme)
		})

		row.appendChild(selectButton)
		row.appendChild(deleteButton)
		themeDropdown.appendChild(row)
	})

	const hasExactMatch = allThemes.some((theme) => normalizeThemeKey(theme.name) === queryKey)

	if (trimmedQuery && !hasExactMatch) {
		const createButton = document.createElement('button')
		createButton.type = 'button'
		createButton.className = 'list-group-item list-group-item-action text-success fw-semibold'
		createButton.textContent = `Create new theme: "${trimmedQuery}"`
		createButton.addEventListener('click', async () => {
			await createTheme(trimmedQuery)
		})
		themeDropdown.appendChild(createButton)
	}

	if (!themeDropdown.children.length) {
		const emptyState = document.createElement('div')
		emptyState.className = 'list-group-item text-body-secondary'
		emptyState.textContent = trimmedQuery ? 'No matching themes.' : 'No themes available.'
		themeDropdown.appendChild(emptyState)
	}

	openDropdown()
}

async function createTheme(themeName) {
	const normalizedName = normalizeTheme(themeName)
	if (!normalizedName) {
		return
	}

	const existingTheme = allThemes.find((theme) => normalizeThemeKey(theme.name) === normalizeThemeKey(normalizedName))
	if (existingTheme) {
		if (!isSelected(existingTheme.name)) {
			selectedThemes.push(existingTheme)
			renderSelectedThemes()
		}
		themeSearchInput.value = ''
		renderDropdown('')
		return
	}

	const nameColumns = getCandidateNameColumns()
	let createdTheme = null
	let lastError = null

	for (const column of nameColumns) {
		const payload = {
			[column]: normalizedName
		}
		const { data, error } = await supabase
			.from(THEME_TABLE)
			.insert([payload])
			.select('*')
			.single()

		if (!error && data) {
			detectedNameColumn = column
			createdTheme = {
				id: extractThemeId(data),
				name: extractThemeName(data)
			}
			break
		}

		lastError = error
	}

	if (!createdTheme) {
		console.error('Failed to create theme:', lastError)
		setStatusRow('Could not create theme in the database.', 'text-danger')
		return
	}

	allThemes.push(createdTheme)
	allThemes.sort((a, b) => a.name.localeCompare(b.name))
	selectedThemes.push(createdTheme)
	themeSearchInput.value = ''
	renderSelectedThemes()
	renderDropdown('')
}

async function deleteTheme(theme) {
	const confirmed = window.confirm(`Delete theme "${theme.name}" from the database?`)
	if (!confirmed) {
		return
	}

	let success = false
	let lastError = null

	if (theme.id !== null && theme.id !== undefined) {
		const idColumns = getCandidateIdColumns()
		for (const column of idColumns) {
			const { error } = await supabase
				.from(THEME_TABLE)
				.delete()
				.eq(column, theme.id)

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
				.from(THEME_TABLE)
				.delete()
				.eq(column, theme.name)

			if (!error) {
				detectedNameColumn = column
				success = true
				break
			}

			lastError = error
		}
	}

	if (!success) {
		console.error('Failed to delete theme:', lastError)
		setStatusRow('Could not delete the selected theme.', 'text-danger')
		return
	}

	const removedKey = normalizeThemeKey(theme.name)
	allThemes = allThemes.filter((storedTheme) => normalizeThemeKey(storedTheme.name) !== removedKey)
	selectedThemes = selectedThemes.filter((storedTheme) => normalizeThemeKey(storedTheme.name) !== removedKey)
	renderSelectedThemes()
	renderDropdown(themeSearchInput.value)
}

themeSearchInput.addEventListener('focus', () => {
	renderDropdown(themeSearchInput.value)
})

themeSearchInput.addEventListener('input', (event) => {
	renderDropdown(event.target.value)
})

themeSearchInput.addEventListener('keydown', async (event) => {
	if (event.key === 'Enter') {
		event.preventDefault()
		const query = normalizeTheme(themeSearchInput.value)
		if (query) {
			await createTheme(query)
		}
	}

	if (event.key === 'Escape') {
		closeDropdown()
	}
})

document.addEventListener('click', (event) => {
	if (!themePicker.contains(event.target)) {
		closeDropdown()
	}
})

const form = document.getElementById('gameLibraryForm')
if (form) {
	form.addEventListener('picker:prefill', (event) => {
		const detail = event instanceof CustomEvent ? event.detail : null
		pendingPrefillThemeIds = normalizeIdList(detail?.theme)
		applyPrefillIfReady()
	})

	form.addEventListener('picker:clear', () => {
		selectedThemes = []
		pendingPrefillThemeIds = []
		renderSelectedThemes()
		themeSearchInput.value = ''
		renderDropdown('')
	})
}

void loadThemes()
