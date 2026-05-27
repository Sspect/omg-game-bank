import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://pedtyonlklzbyikiywru.supabase.co'
const supabaseKey = 'sb_publishable_oLffRxc_yv8J4ZDTuSSPXw_wQtNye15'
const MECHANICS_TABLE = 'Mechanics'

const supabase = createClient(supabaseUrl, supabaseKey)

const mechanicSearchInput = document.getElementById('mechanicSearchInput')
const mechanicDropdown = document.getElementById('mechanicDropdown')
const selectedMechanicsContainer = document.getElementById('selectedMechanics')
const mechanicsHiddenInput = document.getElementById('game_mechanics') || document.getElementById('game_mechanisms')
const mechanicPicker = document.getElementById('mechanicPicker')

if (!mechanicSearchInput || !mechanicDropdown || !selectedMechanicsContainer || !mechanicsHiddenInput || !mechanicPicker) {
	throw new Error('Mechanics picker elements not found in add-game.html')
}

let allMechanics = []
let selectedMechanics = []
let detectedNameColumn = null
let detectedIdColumn = null
let pendingPrefillMechanicIds = []

function normalizeMechanic(value) {
	return String(value ?? '').trim()
}

function normalizeMechanicKey(value) {
	return normalizeMechanic(value).toLowerCase()
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
	const defaults = ['name', 'mechanic', 'mechanic_name', 'title', 'label']
	return detectedNameColumn ? [detectedNameColumn, ...defaults.filter((col) => col !== detectedNameColumn)] : defaults
}

function getCandidateIdColumns() {
	const defaults = ['id', 'mechanic_id', 'uuid']
	return detectedIdColumn ? [detectedIdColumn, ...defaults.filter((col) => col !== detectedIdColumn)] : defaults
}

function extractMechanicName(row) {
	if (!row || typeof row !== 'object') {
		return ''
	}

	const preferredColumns = getCandidateNameColumns()
	for (const column of preferredColumns) {
		if (row[column]) {
			detectedNameColumn = column
			return normalizeMechanic(row[column])
		}
	}

	const fallbackValue = Object.values(row).find((value) => typeof value === 'string' && normalizeMechanic(value))
	return normalizeMechanic(fallbackValue)
}

function extractMechanicId(row) {
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
	mechanicsHiddenInput.value = selectedMechanics
		.map((mechanic) => mechanic.id)
		.filter((id) => id !== null && id !== undefined)
		.join(',')
}

function renderSelectedMechanics() {
	selectedMechanicsContainer.innerHTML = ''

	selectedMechanics.forEach((mechanic) => {
		const badge = document.createElement('span')
		badge.className = 'badge text-bg-primary d-inline-flex align-items-center gap-1 px-2 py-1'
		badge.textContent = mechanic.name

		const removeButton = document.createElement('button')
		removeButton.type = 'button'
		removeButton.className = 'btn-close btn-close-white btn-sm ms-1'
		removeButton.ariaLabel = `Remove ${mechanic.name}`
		removeButton.addEventListener('click', () => {
			selectedMechanics = selectedMechanics.filter((selectedMechanic) => normalizeMechanicKey(selectedMechanic.name) !== normalizeMechanicKey(mechanic.name))
			renderSelectedMechanics()
			renderDropdown(mechanicSearchInput.value)
		})

		badge.appendChild(removeButton)
		selectedMechanicsContainer.appendChild(badge)
	})

	updateHiddenInput()
}

function applyPrefillIfReady() {
	if (!pendingPrefillMechanicIds.length || !allMechanics.length) {
		return
	}

	const pendingIds = new Set(pendingPrefillMechanicIds)
	selectedMechanics = allMechanics.filter((mechanic) => pendingIds.has(Number(mechanic.id)))
	pendingPrefillMechanicIds = []
	renderSelectedMechanics()
	renderDropdown(mechanicSearchInput.value)
}

function openDropdown() {
	mechanicDropdown.classList.remove('d-none')
}

function closeDropdown() {
	mechanicDropdown.classList.add('d-none')
}

function isSelected(mechanicName) {
	const key = normalizeMechanicKey(mechanicName)
	return selectedMechanics.some((mechanic) => normalizeMechanicKey(mechanic.name) === key)
}

function setStatusRow(message, styleClass = 'text-body-secondary') {
	mechanicDropdown.innerHTML = ''
	const statusRow = document.createElement('div')
	statusRow.className = `list-group-item ${styleClass}`
	statusRow.textContent = message
	mechanicDropdown.appendChild(statusRow)
	openDropdown()
}

async function loadMechanics() {
	const { data, error } = await supabase
		.from(MECHANICS_TABLE)
		.select('*')

	if (error) {
		console.error('Failed to load mechanics:', error)
		setStatusRow('Could not load mechanics from the database.', 'text-danger')
		return
	}

	const seen = new Set()
	allMechanics = (data || [])
		.map((row) => {
			const name = extractMechanicName(row)
			return {
				id: extractMechanicId(row),
				name
			}
		})
		.filter((mechanic) => {
			const key = normalizeMechanicKey(mechanic.name)
			if (!key || seen.has(key)) {
				return false
			}
			seen.add(key)
			return true
		})
		.sort((a, b) => a.name.localeCompare(b.name))

	applyPrefillIfReady()
	renderDropdown(mechanicSearchInput.value)
}

function renderDropdown(query = '') {
	const trimmedQuery = normalizeMechanic(query)
	const queryKey = normalizeMechanicKey(trimmedQuery)

	mechanicDropdown.innerHTML = ''

	const filteredMechanics = allMechanics.filter((mechanic) => {
		const mechanicKey = normalizeMechanicKey(mechanic.name)
		const matchesQuery = !queryKey || mechanicKey.includes(queryKey)
		return matchesQuery && !isSelected(mechanic.name)
	})

	filteredMechanics.forEach((mechanic) => {
		const row = document.createElement('div')
		row.className = 'list-group-item d-flex justify-content-between align-items-center'

		const selectButton = document.createElement('button')
		selectButton.type = 'button'
		selectButton.className = 'btn btn-sm btn-outline-secondary flex-grow-1 text-start'
		selectButton.textContent = mechanic.name
		selectButton.addEventListener('click', () => {
			selectedMechanics.push(mechanic)
			mechanicSearchInput.value = ''
			renderSelectedMechanics()
			renderDropdown('')
			mechanicSearchInput.focus()
		})

		const deleteButton = document.createElement('button')
		deleteButton.type = 'button'
		deleteButton.className = 'btn btn-sm btn-outline-danger ms-2'
		deleteButton.textContent = 'Delete'
		deleteButton.addEventListener('click', async (event) => {
			event.stopPropagation()
			await deleteMechanic(mechanic)
		})

		row.appendChild(selectButton)
		row.appendChild(deleteButton)
		mechanicDropdown.appendChild(row)
	})

	const hasExactMatch = allMechanics.some((mechanic) => normalizeMechanicKey(mechanic.name) === queryKey)

	if (trimmedQuery && !hasExactMatch) {
		const createButton = document.createElement('button')
		createButton.type = 'button'
		createButton.className = 'list-group-item list-group-item-action text-success fw-semibold'
		createButton.textContent = `Create new mechanic: "${trimmedQuery}"`
		createButton.addEventListener('click', async () => {
			await createMechanic(trimmedQuery)
		})
		mechanicDropdown.appendChild(createButton)
	}

	if (!mechanicDropdown.children.length) {
		const emptyState = document.createElement('div')
		emptyState.className = 'list-group-item text-body-secondary'
		emptyState.textContent = trimmedQuery ? 'No matching mechanics.' : 'No mechanics available.'
		mechanicDropdown.appendChild(emptyState)
	}

	openDropdown()
}

async function createMechanic(mechanicName) {
	const normalizedName = normalizeMechanic(mechanicName)
	if (!normalizedName) {
		return
	}

	const existingMechanic = allMechanics.find((mechanic) => normalizeMechanicKey(mechanic.name) === normalizeMechanicKey(normalizedName))
	if (existingMechanic) {
		if (!isSelected(existingMechanic.name)) {
			selectedMechanics.push(existingMechanic)
			renderSelectedMechanics()
		}
		mechanicSearchInput.value = ''
		renderDropdown('')
		return
	}

	const nameColumns = getCandidateNameColumns()
	let createdMechanic = null
	let lastError = null

	for (const column of nameColumns) {
		const payload = {
			[column]: normalizedName
		}
		const { data, error } = await supabase
			.from(MECHANICS_TABLE)
			.insert([payload])
			.select('*')
			.single()

		if (!error && data) {
			detectedNameColumn = column
			createdMechanic = {
				id: extractMechanicId(data),
				name: extractMechanicName(data)
			}
			break
		}

		lastError = error
	}

	if (!createdMechanic) {
		console.error('Failed to create mechanic:', lastError)
		setStatusRow('Could not create mechanic in the database.', 'text-danger')
		return
	}

	allMechanics.push(createdMechanic)
	allMechanics.sort((a, b) => a.name.localeCompare(b.name))
	selectedMechanics.push(createdMechanic)
	mechanicSearchInput.value = ''
	renderSelectedMechanics()
	renderDropdown('')
}

async function deleteMechanic(mechanic) {
	const confirmed = window.confirm(`Delete mechanic "${mechanic.name}" from the database?`)
	if (!confirmed) {
		return
	}

	let success = false
	let lastError = null

	if (mechanic.id !== null && mechanic.id !== undefined) {
		const idColumns = getCandidateIdColumns()
		for (const column of idColumns) {
			const { error } = await supabase
				.from(MECHANICS_TABLE)
				.delete()
				.eq(column, mechanic.id)

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
				.from(MECHANICS_TABLE)
				.delete()
				.eq(column, mechanic.name)

			if (!error) {
				detectedNameColumn = column
				success = true
				break
			}

			lastError = error
		}
	}

	if (!success) {
		console.error('Failed to delete mechanic:', lastError)
		setStatusRow('Could not delete the selected mechanic.', 'text-danger')
		return
	}

	const removedKey = normalizeMechanicKey(mechanic.name)
	allMechanics = allMechanics.filter((storedMechanic) => normalizeMechanicKey(storedMechanic.name) !== removedKey)
	selectedMechanics = selectedMechanics.filter((storedMechanic) => normalizeMechanicKey(storedMechanic.name) !== removedKey)
	renderSelectedMechanics()
	renderDropdown(mechanicSearchInput.value)
}

mechanicSearchInput.addEventListener('focus', () => {
	renderDropdown(mechanicSearchInput.value)
})

mechanicSearchInput.addEventListener('input', (event) => {
	renderDropdown(event.target.value)
})

mechanicSearchInput.addEventListener('keydown', async (event) => {
	if (event.key === 'Enter') {
		event.preventDefault()
		const query = normalizeMechanic(mechanicSearchInput.value)
		if (query) {
			await createMechanic(query)
		}
	}

	if (event.key === 'Escape') {
		closeDropdown()
	}
})

document.addEventListener('click', (event) => {
	if (!mechanicPicker.contains(event.target)) {
		closeDropdown()
	}
})

const form = document.getElementById('gameLibraryForm')
if (form) {
	form.addEventListener('picker:prefill', (event) => {
		const detail = event instanceof CustomEvent ? event.detail : null
		pendingPrefillMechanicIds = normalizeIdList(detail?.mechanics)
		applyPrefillIfReady()
	})

	form.addEventListener('picker:clear', () => {
		selectedMechanics = []
		pendingPrefillMechanicIds = []
		renderSelectedMechanics()
		mechanicSearchInput.value = ''
		renderDropdown('')
	})
}

void loadMechanics()
