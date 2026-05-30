import { supabase } from './supabase.js'
import { getElementByIdFallback, mapTagRowsToItems } from './tags.js'

const tables = [
	{
		tableName: 'Mechanics',
		containerId: 'mechanicsLookupTableContainer',
		nameColumns: ['name', 'mechanic', 'mechanic_name', 'title', 'label'],
		idColumns: ['id', 'mechanic_id', 'uuid']
	},
	{
		tableName: 'Theme',
		containerId: 'themeLookupTableContainer',
		nameColumns: ['name', 'theme', 'theme_name', 'title', 'label'],
		idColumns: ['id', 'theme_id', 'uuid']
	},
	{
		tableName: 'Vibes',
		containerId: 'vibesLookupTableContainer',
		nameColumns: ['name', 'vibe', 'vibe_name', 'title', 'label'],
		idColumns: ['id', 'vibe_id', 'uuid']
	}
]

function renderStatus(container, message, statusClass = 'text-body-secondary') {
	container.innerHTML = `<div class="small ${statusClass}">${message}</div>`
}

function renderLookupTable(container, items) {
	if (!items.length) {
		renderStatus(container, 'No rows found.')
		return
	}

	const bodyRows = items
		.map((item) => `<tr><td class="small">${item.id ?? '-'}</td><td class="small">${item.name}</td></tr>`)
		.join('')

	container.innerHTML = `
		<div class="table-responsive">
			<table class="table table-sm table-dark table-striped table-hover mb-0 align-middle">
				<thead>
					<tr>
						<th scope="col" style="width: 35%;">ID</th>
						<th scope="col">Name</th>
					</tr>
				</thead>
				<tbody>
					${bodyRows}
				</tbody>
			</table>
		</div>
	`
}

async function loadOneTable({ tableName, containerId, nameColumns, idColumns }) {
	const container = document.getElementById(containerId)
	if (!container) {
		return
	}

	renderStatus(container, 'Loading...')

	const { data, error } = await supabase
		.from(tableName)
		.select('*')

	if (error) {
		console.error(`Failed to load ${tableName}:`, error)
		renderStatus(container, `Could not load ${tableName}.`, 'text-danger')
		return
	}

	const items = mapTagRowsToItems(data, { nameColumns, idColumns })
	renderLookupTable(container, items)
}

async function loadAllTables() {
	await Promise.all(tables.map((tableConfig) => loadOneTable(tableConfig)))
}

function setup() {
	const collapseElement = getElementByIdFallback(['gptInstructionsCollapse'])
	const refreshButton = getElementByIdFallback(['refreshTagLookupTables'])

	if (!collapseElement) {
		return
	}

	let hasLoaded = false

	collapseElement.addEventListener('shown.bs.collapse', async () => {
		if (hasLoaded) {
			return
		}

		hasLoaded = true
		await loadAllTables()
	})

	if (refreshButton) {
		refreshButton.addEventListener('click', async () => {
			await loadAllTables()
		})
	}
}

setup()
