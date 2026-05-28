import { supabase } from './supabase.js'

const TAGS_TABLE = 'Tags'

const tagSearchInput = document.getElementById('tagSearchInput')
const tagDropdown = document.getElementById('tagDropdown')
const selectedTagsContainer = document.getElementById('selectedTags')
const tagsHiddenInput = document.getElementById('tags')
const tagPicker = document.getElementById('tagPicker')

if (!tagSearchInput || !tagDropdown || !selectedTagsContainer || !tagsHiddenInput || !tagPicker) {
	throw new Error('Tag picker elements not found in add-game.html')
}

let allTags = []
let selectedTags = []
let detectedNameColumn = null
let detectedIdColumn = null
let pendingPrefillTagIds = []

function normalizeTag(value) {
	return String(value ?? '').trim()
}

function normalizeTagKey(value) {
	return normalizeTag(value).toLowerCase()
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
	const defaults = ['name', 'tag', 'tag_name', 'title', 'label']
	return detectedNameColumn ? [detectedNameColumn, ...defaults.filter((col) => col !== detectedNameColumn)] : defaults
}

function getCandidateIdColumns() {
	const defaults = ['id', 'tag_id', 'uuid']
	return detectedIdColumn ? [detectedIdColumn, ...defaults.filter((col) => col !== detectedIdColumn)] : defaults
}

function extractTagName(row) {
	if (!row || typeof row !== 'object') {
		return ''
	}

	const preferredColumns = getCandidateNameColumns()
	for (const column of preferredColumns) {
		if (row[column]) {
			detectedNameColumn = column
			return normalizeTag(row[column])
		}
	}

	const fallbackValue = Object.values(row).find((value) => typeof value === 'string' && normalizeTag(value))
	return normalizeTag(fallbackValue)
}

function extractTagId(row) {
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
	tagsHiddenInput.value = selectedTags
		.map((tag) => tag.id)
		.filter((id) => id !== null && id !== undefined)
		.join(',')
}

function renderSelectedTags() {
	selectedTagsContainer.innerHTML = ''

	selectedTags.forEach((tag) => {
		const badge = document.createElement('span')
		badge.className = 'badge text-bg-primary d-inline-flex align-items-center gap-1 px-2 py-1'
		badge.textContent = tag.name

		const removeButton = document.createElement('button')
		removeButton.type = 'button'
		removeButton.className = 'btn-close btn-close-white btn-sm ms-1'
		removeButton.ariaLabel = `Remove ${tag.name}`
		removeButton.addEventListener('click', () => {
			selectedTags = selectedTags.filter((selectedTag) => normalizeTagKey(selectedTag.name) !== normalizeTagKey(tag.name))
			renderSelectedTags()
			renderDropdown(tagSearchInput.value)
		})

		badge.appendChild(removeButton)
		selectedTagsContainer.appendChild(badge)
	})

	updateHiddenInput()
}

function applyPrefillIfReady() {
	if (!pendingPrefillTagIds.length || !allTags.length) {
		return
	}

	const pendingIds = new Set(pendingPrefillTagIds)
	selectedTags = allTags.filter((tag) => pendingIds.has(Number(tag.id)))
	pendingPrefillTagIds = []
	renderSelectedTags()
	renderDropdown(tagSearchInput.value)
}

function openDropdown() {
	tagDropdown.classList.remove('d-none')
}

function closeDropdown() {
	tagDropdown.classList.add('d-none')
}

function isSelected(tagName) {
	const key = normalizeTagKey(tagName)
	return selectedTags.some((tag) => normalizeTagKey(tag.name) === key)
}

function setStatusRow(message, styleClass = 'text-body-secondary') {
	tagDropdown.innerHTML = ''
	const statusRow = document.createElement('div')
	statusRow.className = `list-group-item ${styleClass}`
	statusRow.textContent = message
	tagDropdown.appendChild(statusRow)
	openDropdown()
}

async function loadTags() {
	const { data, error } = await supabase
		.from(TAGS_TABLE)
		.select('*')

	if (error) {
		console.error('Failed to load tags:', error)
		setStatusRow('Could not load tags from the database.', 'text-danger')
		return
	}

	const seen = new Set()
	allTags = (data || [])
		.map((row) => {
			const name = extractTagName(row)
			return {
				id: extractTagId(row),
				name
			}
		})
		.filter((tag) => {
			const key = normalizeTagKey(tag.name)
			if (!key || seen.has(key)) {
				return false
			}
			seen.add(key)
			return true
		})
		.sort((a, b) => a.name.localeCompare(b.name))

	applyPrefillIfReady()
	renderDropdown(tagSearchInput.value)
}

function renderDropdown(query = '') {
	const trimmedQuery = normalizeTag(query)
	const queryKey = normalizeTagKey(trimmedQuery)

	tagDropdown.innerHTML = ''

	const filteredTags = allTags.filter((tag) => {
		const tagKey = normalizeTagKey(tag.name)
		const matchesQuery = !queryKey || tagKey.includes(queryKey)
		return matchesQuery && !isSelected(tag.name)
	})

	filteredTags.forEach((tag) => {
		const row = document.createElement('div')
		row.className = 'list-group-item d-flex justify-content-between align-items-center'

		const selectButton = document.createElement('button')
		selectButton.type = 'button'
		selectButton.className = 'btn btn-sm btn-outline-secondary flex-grow-1 text-start'
		selectButton.textContent = tag.name
		selectButton.addEventListener('click', () => {
			selectedTags.push(tag)
			tagSearchInput.value = ''
			renderSelectedTags()
			renderDropdown('')
			tagSearchInput.focus()
		})

		const deleteButton = document.createElement('button')
		deleteButton.type = 'button'
		deleteButton.className = 'btn btn-sm btn-outline-danger ms-2'
		deleteButton.textContent = 'Delete'
		deleteButton.addEventListener('click', async (event) => {
			event.stopPropagation()
			await deleteTag(tag)
		})

		row.appendChild(selectButton)
		row.appendChild(deleteButton)
		tagDropdown.appendChild(row)
	})

	const hasExactMatch = allTags.some((tag) => normalizeTagKey(tag.name) === queryKey)

	if (trimmedQuery && !hasExactMatch) {
		const createButton = document.createElement('button')
		createButton.type = 'button'
		createButton.className = 'list-group-item list-group-item-action text-success fw-semibold'
		createButton.textContent = `Create new tag: "${trimmedQuery}"`
		createButton.addEventListener('click', async () => {
			await createTag(trimmedQuery)
		})
		tagDropdown.appendChild(createButton)
	}

	if (!tagDropdown.children.length) {
		const emptyState = document.createElement('div')
		emptyState.className = 'list-group-item text-body-secondary'
		emptyState.textContent = trimmedQuery ? 'No matching tags.' : 'No tags available.'
		tagDropdown.appendChild(emptyState)
	}

	openDropdown()
}

async function createTag(tagName) {
	const normalizedName = normalizeTag(tagName)
	if (!normalizedName) {
		return
	}

	const existingTag = allTags.find((tag) => normalizeTagKey(tag.name) === normalizeTagKey(normalizedName))
	if (existingTag) {
		if (!isSelected(existingTag.name)) {
			selectedTags.push(existingTag)
			renderSelectedTags()
		}
		tagSearchInput.value = ''
		renderDropdown('')
		return
	}

	const nameColumns = getCandidateNameColumns()
	let createdTag = null
	let lastError = null

	for (const column of nameColumns) {
		const payload = {
			[column]: normalizedName
		}
		const { data, error } = await supabase
			.from(TAGS_TABLE)
			.insert([payload])
			.select('*')
			.single()

		if (!error && data) {
			detectedNameColumn = column
			createdTag = {
				id: extractTagId(data),
				name: extractTagName(data)
			}
			break
		}

		lastError = error
	}

	if (!createdTag) {
		console.error('Failed to create tag:', lastError)
		setStatusRow('Could not create tag in the database.', 'text-danger')
		return
	}

	allTags.push(createdTag)
	allTags.sort((a, b) => a.name.localeCompare(b.name))
	selectedTags.push(createdTag)
	tagSearchInput.value = ''
	renderSelectedTags()
	renderDropdown('')
}

async function deleteTag(tag) {
	const confirmed = window.confirm(`Delete tag "${tag.name}" from the database?`)
	if (!confirmed) {
		return
	}

	let success = false
	let lastError = null

	if (tag.id !== null && tag.id !== undefined) {
		const idColumns = getCandidateIdColumns()
		for (const column of idColumns) {
			const { error } = await supabase
				.from(TAGS_TABLE)
				.delete()
				.eq(column, tag.id)

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
				.from(TAGS_TABLE)
				.delete()
				.eq(column, tag.name)

			if (!error) {
				detectedNameColumn = column
				success = true
				break
			}

			lastError = error
		}
	}

	if (!success) {
		console.error('Failed to delete tag:', lastError)
		setStatusRow('Could not delete the selected tag.', 'text-danger')
		return
	}

	const removedKey = normalizeTagKey(tag.name)
	allTags = allTags.filter((storedTag) => normalizeTagKey(storedTag.name) !== removedKey)
	selectedTags = selectedTags.filter((storedTag) => normalizeTagKey(storedTag.name) !== removedKey)
	renderSelectedTags()
	renderDropdown(tagSearchInput.value)
}

tagSearchInput.addEventListener('focus', () => {
	renderDropdown(tagSearchInput.value)
})

tagSearchInput.addEventListener('input', (event) => {
	renderDropdown(event.target.value)
})

tagSearchInput.addEventListener('keydown', async (event) => {
	if (event.key === 'Enter') {
		event.preventDefault()
		const query = normalizeTag(tagSearchInput.value)
		if (query) {
			await createTag(query)
		}
	}

	if (event.key === 'Escape') {
		closeDropdown()
	}
})

document.addEventListener('click', (event) => {
	if (!tagPicker.contains(event.target)) {
		closeDropdown()
	}
})

const form = document.getElementById('gameLibraryForm')
if (form) {
	form.addEventListener('picker:prefill', (event) => {
		const detail = event instanceof CustomEvent ? event.detail : null
		pendingPrefillTagIds = normalizeIdList(detail?.tags)
		applyPrefillIfReady()
	})

	form.addEventListener('picker:clear', () => {
		selectedTags = []
		pendingPrefillTagIds = []
		renderSelectedTags()
		tagSearchInput.value = ''
		renderDropdown('')
	})
}

void loadTags()
