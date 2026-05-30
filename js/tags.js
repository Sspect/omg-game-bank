export function getElementByIdFallback(ids) {
	for (const id of ids) {
		const element = document.getElementById(id)
		if (element) {
			return element
		}
	}

	return null
}

export function normalizeIdList(value) {
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

export function setupTagPicker({
	supabase,
	tableName,
	itemLabel,
	itemLabelPlural,
	searchInput,
	dropdown,
	selectedContainer,
	hiddenInput,
	picker,
	form,
	prefillDetailKeys,
	nameColumns,
	idColumns
}) {
	let allItems = []
	let selectedItems = []
	let detectedNameColumn = null
	let detectedIdColumn = null
	let pendingPrefillIds = []

	function normalizeValue(value) {
		return String(value ?? '').trim()
	}

	function normalizeKey(value) {
		return normalizeValue(value).toLowerCase()
	}

	function getCandidateNameColumns() {
		return detectedNameColumn
			? [detectedNameColumn, ...nameColumns.filter((column) => column !== detectedNameColumn)]
			: nameColumns
	}

	function getCandidateIdColumns() {
		return detectedIdColumn ? [detectedIdColumn, ...idColumns.filter((column) => column !== detectedIdColumn)] : idColumns
	}

	function extractName(row) {
		if (!row || typeof row !== 'object') {
			return ''
		}

		for (const column of getCandidateNameColumns()) {
			if (row[column]) {
				detectedNameColumn = column
				return normalizeValue(row[column])
			}
		}

		const fallback = Object.values(row).find((value) => typeof value === 'string' && normalizeValue(value))
		return normalizeValue(fallback)
	}

	function extractId(row) {
		if (!row || typeof row !== 'object') {
			return null
		}

		for (const column of getCandidateIdColumns()) {
			if (row[column] !== undefined && row[column] !== null) {
				detectedIdColumn = column
				return row[column]
			}
		}

		return null
	}

	function updateHiddenInput() {
		hiddenInput.value = selectedItems
			.map((item) => item.id)
			.filter((id) => id !== null && id !== undefined)
			.join(',')
	}

	function isSelected(itemName) {
		const key = normalizeKey(itemName)
		return selectedItems.some((item) => normalizeKey(item.name) === key)
	}

	function openDropdown() {
		dropdown.classList.remove('d-none')
	}

	function closeDropdown() {
		dropdown.classList.add('d-none')
	}

	function setStatusRow(message, styleClass = 'text-body-secondary') {
		dropdown.innerHTML = ''
		const statusRow = document.createElement('div')
		statusRow.className = `list-group-item ${styleClass}`
		statusRow.textContent = message
		dropdown.appendChild(statusRow)
		openDropdown()
	}

	function renderSelectedItems() {
		selectedContainer.innerHTML = ''

		selectedItems.forEach((item) => {
			const badge = document.createElement('span')
			badge.className = 'badge text-bg-primary d-inline-flex align-items-center gap-1 px-2 py-1'
			badge.textContent = item.name

			const removeButton = document.createElement('button')
			removeButton.type = 'button'
			removeButton.className = 'btn-close btn-close-white btn-sm ms-1'
			removeButton.ariaLabel = `Remove ${item.name}`
			removeButton.addEventListener('click', () => {
				selectedItems = selectedItems.filter((selectedItem) => normalizeKey(selectedItem.name) !== normalizeKey(item.name))
				renderSelectedItems()
				renderDropdown(searchInput.value)
			})

			badge.appendChild(removeButton)
			selectedContainer.appendChild(badge)
		})

		updateHiddenInput()
	}

	function applyPrefillIfReady() {
		if (!pendingPrefillIds.length || !allItems.length) {
			return
		}

		const pendingIds = new Set(pendingPrefillIds)
		selectedItems = allItems.filter((item) => pendingIds.has(Number(item.id)))
		pendingPrefillIds = []
		renderSelectedItems()
		renderDropdown(searchInput.value)
	}

	async function createItem(itemName) {
		const normalizedName = normalizeValue(itemName)
		if (!normalizedName) {
			return
		}

		const existingItem = allItems.find((item) => normalizeKey(item.name) === normalizeKey(normalizedName))
		if (existingItem) {
			if (!isSelected(existingItem.name)) {
				selectedItems.push(existingItem)
				renderSelectedItems()
			}
			searchInput.value = ''
			renderDropdown('')
			return
		}

		let createdItem = null
		let lastError = null

		for (const column of getCandidateNameColumns()) {
			const payload = {
				[column]: normalizedName
			}

			const { data, error } = await supabase
				.from(tableName)
				.insert([payload])
				.select('*')
				.single()

			if (!error && data) {
				detectedNameColumn = column
				createdItem = {
					id: extractId(data),
					name: extractName(data)
				}
				break
			}

			lastError = error
		}

		if (!createdItem) {
			console.error(`Failed to create ${itemLabel}:`, lastError)
			setStatusRow(`Could not create ${itemLabel} in the database.`, 'text-danger')
			return
		}

		allItems.push(createdItem)
		allItems.sort((a, b) => a.name.localeCompare(b.name))
		selectedItems.push(createdItem)
		searchInput.value = ''
		renderSelectedItems()
		renderDropdown('')
	}

	async function deleteItem(item) {
		const confirmed = window.confirm(`Delete ${itemLabel} "${item.name}" from the database?`)
		if (!confirmed) {
			return
		}

		let success = false
		let lastError = null

		if (item.id !== null && item.id !== undefined) {
			for (const column of getCandidateIdColumns()) {
				const { error } = await supabase
					.from(tableName)
					.delete()
					.eq(column, item.id)

				if (!error) {
					detectedIdColumn = column
					success = true
					break
				}

				lastError = error
			}
		}

		if (!success) {
			for (const column of getCandidateNameColumns()) {
				const { error } = await supabase
					.from(tableName)
					.delete()
					.eq(column, item.name)

				if (!error) {
					detectedNameColumn = column
					success = true
					break
				}

				lastError = error
			}
		}

		if (!success) {
			console.error(`Failed to delete ${itemLabel}:`, lastError)
			setStatusRow(`Could not delete the selected ${itemLabel}.`, 'text-danger')
			return
		}

		const removedKey = normalizeKey(item.name)
		allItems = allItems.filter((storedItem) => normalizeKey(storedItem.name) !== removedKey)
		selectedItems = selectedItems.filter((storedItem) => normalizeKey(storedItem.name) !== removedKey)
		renderSelectedItems()
		renderDropdown(searchInput.value)
	}

	function renderDropdown(query = '') {
		const trimmedQuery = normalizeValue(query)
		const queryKey = normalizeKey(trimmedQuery)

		dropdown.innerHTML = ''

		const filteredItems = allItems.filter((item) => {
			const itemKey = normalizeKey(item.name)
			const matchesQuery = !queryKey || itemKey.includes(queryKey)
			return matchesQuery && !isSelected(item.name)
		})

		filteredItems.forEach((item) => {
			const row = document.createElement('div')
			row.className = 'list-group-item d-flex justify-content-between align-items-center'

			const selectButton = document.createElement('button')
			selectButton.type = 'button'
			selectButton.className = 'btn btn-sm btn-outline-secondary flex-grow-1 text-start'
			selectButton.textContent = item.name
			selectButton.addEventListener('click', () => {
				selectedItems.push(item)
				searchInput.value = ''
				renderSelectedItems()
				renderDropdown('')
				searchInput.focus()
			})

			const deleteButton = document.createElement('button')
			deleteButton.type = 'button'
			deleteButton.className = 'btn btn-sm btn-outline-danger ms-2'
			deleteButton.textContent = 'Delete'
			deleteButton.addEventListener('click', async (event) => {
				event.stopPropagation()
				await deleteItem(item)
			})

			row.appendChild(selectButton)
			row.appendChild(deleteButton)
			dropdown.appendChild(row)
		})

		const hasExactMatch = allItems.some((item) => normalizeKey(item.name) === queryKey)
		if (trimmedQuery && !hasExactMatch) {
			const createButton = document.createElement('button')
			createButton.type = 'button'
			createButton.className = 'list-group-item list-group-item-action text-success fw-semibold'
			createButton.textContent = `Create new ${itemLabel}: "${trimmedQuery}"`
			createButton.addEventListener('click', async () => {
				await createItem(trimmedQuery)
			})
			dropdown.appendChild(createButton)
		}

		if (!dropdown.children.length) {
			const emptyState = document.createElement('div')
			emptyState.className = 'list-group-item text-body-secondary'
			emptyState.textContent = trimmedQuery ? `No matching ${itemLabelPlural}.` : `No ${itemLabelPlural} available.`
			dropdown.appendChild(emptyState)
		}

		openDropdown()
	}

	async function loadItems() {
		const { data, error } = await supabase
			.from(tableName)
			.select('*')

		if (error) {
			console.error(`Failed to load ${itemLabelPlural}:`, error)
			setStatusRow(`Could not load ${itemLabelPlural} from the database.`, 'text-danger')
			return
		}

		const seen = new Set()
		allItems = (data || [])
			.map((row) => {
				const name = extractName(row)
				return {
					id: extractId(row),
					name
				}
			})
			.filter((item) => {
				const key = normalizeKey(item.name)
				if (!key || seen.has(key)) {
					return false
				}
				seen.add(key)
				return true
			})
			.sort((a, b) => a.name.localeCompare(b.name))

		applyPrefillIfReady()
		renderDropdown(searchInput.value)
	}

	searchInput.addEventListener('focus', () => {
		renderDropdown(searchInput.value)
	})

	searchInput.addEventListener('input', (event) => {
		renderDropdown(event.target.value)
	})

	searchInput.addEventListener('keydown', async (event) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			const query = normalizeValue(searchInput.value)
			if (query) {
				await createItem(query)
			}
		}

		if (event.key === 'Escape') {
			closeDropdown()
		}
	})

	document.addEventListener('click', (event) => {
		if (!picker.contains(event.target)) {
			closeDropdown()
		}
	})

	if (form) {
		form.addEventListener('picker:prefill', (event) => {
			const detail = event instanceof CustomEvent ? event.detail : null
			const prefillValue = prefillDetailKeys
				.map((key) => detail?.[key])
				.find((value) => value !== undefined && value !== null)

			pendingPrefillIds = normalizeIdList(prefillValue)
			applyPrefillIfReady()
		})

		form.addEventListener('picker:clear', () => {
			selectedItems = []
			pendingPrefillIds = []
			renderSelectedItems()
			searchInput.value = ''
			renderDropdown('')
		})
	}

	void loadItems()
}
