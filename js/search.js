import { supabase, supabaseUrl } from './supabase.js'

const publicBucketBaseUrl = `${supabaseUrl}/storage/v1/object/public/game-image/`

const TAGS_TABLE = 'Tags'
const THEME_TABLE = 'Theme'
const MECHANICS_TABLE = 'Mechanics'

const controlsContainer = document.getElementById('displayFieldControls')
/* Choose What To Display / controlsContainer */
const gamesList = document.getElementById('gamesList')
const selectAllButton = document.getElementById('selectAllDisplayFields')
const deselectAllButton = document.getElementById('deselectAllDisplayFields')

if (!controlsContainer || !gamesList || !selectAllButton || !deselectAllButton) {
	throw new Error('Required display settings elements are missing in games.html')
}

const relationLookupMaps = {
	tags: new Map(),
	theme: new Map(),
	mechanics: new Map()
}

function toIdKey(value) {
	const normalized = String(value ?? '').trim()
	return normalized || null
}

function parseIdList(value) {
	if (value === null || value === undefined) {
		return []
	}

	let parsedValue = value

	if (typeof parsedValue === 'string') {
		const trimmed = parsedValue.trim()
		if (!trimmed) {
			return []
		}

		if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
			try {
				parsedValue = JSON.parse(trimmed)
			} catch {
				parsedValue = trimmed
			}
		}
	}

	if (Array.isArray(parsedValue)) {
		return parsedValue
			.map((item) => toIdKey(item))
			.filter(Boolean)
	}

	if (typeof parsedValue === 'string') {
		return parsedValue
			.split(',')
			.map((item) => toIdKey(item))
			.filter(Boolean)
	}

	const single = toIdKey(parsedValue)
	return single ? [single] : []
}

function getFirstAvailableColumn(rows, candidates, valuePredicate) {
	for (const candidate of candidates) {
		if (rows.some((row) => valuePredicate(row?.[candidate]))) {
			return candidate
		}
	}
	return null
}

function buildRelationLookupMap(rows, idCandidates, nameCandidates) {
	const lookup = new Map()
	const safeRows = Array.isArray(rows) ? rows : []

	const idColumn = getFirstAvailableColumn(
		safeRows,
		idCandidates,
		(value) => value !== null && value !== undefined && String(value).trim() !== ''
	)
	const nameColumn = getFirstAvailableColumn(
		safeRows,
		nameCandidates,
		(value) => typeof value === 'string' && value.trim() !== ''
	)

	if (!idColumn || !nameColumn) {
		return lookup
	}

	safeRows.forEach((row) => {
		const idKey = toIdKey(row?.[idColumn])
		const nameValue = String(row?.[nameColumn] ?? '').trim()
		if (idKey && nameValue) {
			lookup.set(idKey, nameValue)
		}
	})

	return lookup
}

function formatRelationValues(value, lookupMap) {
	const ids = parseIdList(value)
	if (!ids.length) {
		return null
	}

	const names = ids.map((id) => lookupMap.get(id) || id)
	return names.join(', ')
}

async function loadRelationLookupMaps() {
	const [tagsResult, themeResult, mechanicsResult] = await Promise.all([
		supabase.from(TAGS_TABLE).select('*'),
		supabase.from(THEME_TABLE).select('*'),
		supabase.from(MECHANICS_TABLE).select('*')
	])

	if (tagsResult.error) {
		console.error('Error loading tag lookup table:', tagsResult.error)
	}
	if (themeResult.error) {
		console.error('Error loading theme lookup table:', themeResult.error)
	}
	if (mechanicsResult.error) {
		console.error('Error loading mechanics lookup table:', mechanicsResult.error)
	}

	relationLookupMaps.tags = buildRelationLookupMap(
		tagsResult.data,
		['id', 'tag_id', 'uuid'],
		['name', 'tag', 'tag_name', 'title', 'label']
	)
	relationLookupMaps.theme = buildRelationLookupMap(
		themeResult.data,
		['id', 'theme_id', 'uuid'],
		['name', 'theme', 'theme_name', 'title', 'label']
	)
	relationLookupMaps.mechanics = buildRelationLookupMap(
		mechanicsResult.data,
		['id', 'mechanic_id', 'uuid'],
		['name', 'mechanic', 'mechanic_name', 'title', 'label']
	)
}

function formatKnownRange(minValue, maxValue, minLabel, maxLabel) {
	const hasMin = minValue !== null && minValue !== undefined
	const hasMax = maxValue !== null && maxValue !== undefined

	if (hasMin && hasMax) {
		return `${minValue} - ${maxValue}`
	}

	if (hasMin) {
		return `${minLabel}: ${minValue}`
	}

	if (hasMax) {
		return `${maxLabel}: ${maxValue}`
	}

	return null
}

const DISPLAY_FIELDS = [
	{
		key: 'owner',
		label: 'Owner',
		getValue: (game) => game.owner
	},
	{
		key: 'players',
		label: 'Players',
		getValue: (game) => {
			const min = game.players_min ?? game.min_players
			const max = game.players_max ?? game.max_players
			return formatKnownRange(min, max, 'Minimum players', 'Maximum players')
		}
	},
	{
		key: 'time',
		label: 'Play Time (min)',
		getValue: (game) => {
			const min = game.time_min
			const max = game.time_max
			return formatKnownRange(min, max, 'Minimum play time (min)', 'Maximum play time (min)')
		}
	},
	{
		key: 'complexity',
		label: 'Complexity',
		getValue: (game) => game.game_complexity
	},
	{
		key: 'recommended_age',
		label: 'Recommended Age',
		getValue: (game) => game.recommended_age
	},
	{
		key: 'designer',
		label: 'Designer',
		getValue: (game) => game.game_designer
	},
	{
		key: 'publisher',
		label: 'Publisher',
		getValue: (game) => game.publisher
	},
	{
		key: 'description',
		label: 'Description',
		getValue: (game) => game.description ?? game.game_description
	},
	{
		key: 'tags',
		label: 'Tags',
		getValue: (game) => formatRelationValues(game.tags, relationLookupMaps.tags)
	},
	{
		key: 'theme',
		label: 'Theme',
		getValue: (game) => formatRelationValues(game.theme, relationLookupMaps.theme)
	},
	{
		key: 'mechanics',
		label: 'Mechanics',
		getValue: (game) => formatRelationValues(game.mechanics, relationLookupMaps.mechanics)
	},
	{
		key: 'language',
		label: 'Language',
		getValue: (game) => game.language
	},
	{
		key: 'year_published',
		label: 'Year Published',
		getValue: (game) => game.year_published
	},
	{
		key: 'expansion',
		label: 'Expansion',
		getValue: (game) => {
			if (game.expansion === true) {
				return 'Yes'
			}
			if (game.expansion === false) {
				return 'No'
			}
			return null
		}
	},
	{
		key: 'created_at',
		label: 'Created At',
		getValue: (game) => game.created_at
	},
	{
		key: 'more_info',
		label: 'More Info',
		getValue: (game) => game.more_info
	},
	{
		key: 'image',
		label: 'Image',
		getValue: (game) => game.card_image_path
	}
]
const selectedFields = new Set(["players", "owner", "image", "description", "time", "complexity"])
let games = []

function toPublicImageUrl(imagePath) {
	if (!imagePath) {
		return ''
	}

	const rawPath = String(imagePath).trim()
	if (!rawPath) {
		return ''
	}

	if (/^https?:\/\//i.test(rawPath)) {
		return rawPath
	}

	const normalizedPath = rawPath.replace(/^\/+/, '')
	return `${publicBucketBaseUrl}${normalizedPath}`
}

function formatValue(field, value) {
	if (value === null || value === undefined || value === '') {
		return null
	}

	if (field.key === 'more_info') {
		const url = String(value)
		return `<a href="${url}" target="_blank" rel="noopener noreferrer">${new URL(url).hostname.replace('www.', '')}</a>`;
	}

	if (field.key === 'created_at') {
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) {
			return String(value)
		}
		return date.toLocaleString()
	}

	return String(value)
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function formatDescriptionHtml(value) {
	if (value === null || value === undefined || value === '') {
		return null
	}

	return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function renderGames() {
	gamesList.innerHTML = ''

	if (!games.length) {
		gamesList.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No games found.</div></div>'
		return
	}

	games.forEach((game) => {
		const card = document.createElement('article')
		card.className = 'col-12 col-md-6 col-xl-4'
		const imageEnabled = selectedFields.has('image')
		const imageUrl = imageEnabled ? toPublicImageUrl(game.card_image_path) : ''
		const imageStatus = imageEnabled && !imageUrl
			? '<p class="text-body-secondary small mb-3">Image: Not available</p>'
			: ''
		const descriptionField = DISPLAY_FIELDS.find((field) => field.key === 'description')
		const descriptionEnabled = selectedFields.has('description')
		const descriptionValue = descriptionField && descriptionEnabled
			? formatDescriptionHtml(descriptionField.getValue(game))
			: null
		const descriptionBox = descriptionEnabled
			? `<div class="mb-3 p-3 border rounded bg-body-tertiary"><strong>Description</strong><p class="mb-0 mt-2">${descriptionValue || '<span class="text-body-secondary">Not available</span>'}</p></div>`
			: ''

		const details = DISPLAY_FIELDS
			.filter((field) => selectedFields.has(field.key) && field.key !== 'image' && field.key !== 'description')
			.map((field) => {
				const formatted = formatValue(field, field.getValue(game))
				return `<li class="list-group-item"><strong>${field.label}:</strong> ${formatted || '<span class="text-body-secondary">Not available</span>'}</li>`
			})
			.join('')

		const editHref = Number.isInteger(game.id)
			? `edit-game.html?id=${encodeURIComponent(game.id)}`
			: 'edit-game.html'

		card.innerHTML = `
			<div class="card h-100 shadow-sm game-card" ${imageUrl ? `style="background-image: url('${imageUrl}')"` : ''}>
				<div class="card-body">
					<div class="game-card-title-row mb-3">
						<h3 class="h5 card-title mb-0">${game.name || 'Unnamed game'}</h3>
						<a class="edit-game-link" href="${editHref}" aria-label="Edit ${game.name || 'game'}" title="Edit game">
							<img src="assets/svg/icons/pencil-square.svg" alt="" width="18" height="18">
						</a>
					</div>
					${imageStatus}
					${descriptionBox}
					${details ? `<ul class="list-group list-group-flush">${details}</ul>` : '<p class="text-body-secondary mb-0">No extra fields selected.</p>'}
				</div>
			</div>
		`

		gamesList.appendChild(card)
	})
}

function onFieldToggle(event) {
	const checkbox = event.target
	if (!checkbox || checkbox.type !== 'checkbox') {
		return
	}

	const fieldKey = checkbox.value
	if (checkbox.checked) {
		selectedFields.add(fieldKey)
	} else {
		selectedFields.delete(fieldKey)
	}

	renderGames()
}

function renderFieldControls() {
	controlsContainer.innerHTML = ''

	DISPLAY_FIELDS.forEach((field) => {
		const wrapper = document.createElement('div')
		wrapper.className = 'col-12 col-sm-6 col-md-4 col-lg-3'

		wrapper.innerHTML = `
			<div class="form-check">
				<input class="form-check-input" type="checkbox" id="display-${field.key}" value="${field.key}" ${selectedFields.has(field.key) ? 'checked' : ''}>
				<label class="form-check-label" for="display-${field.key}">${field.label}</label>
			</div>
		`

		controlsContainer.appendChild(wrapper)
	})

	controlsContainer.removeEventListener('change', onFieldToggle)
	controlsContainer.addEventListener('change', onFieldToggle)
}

function selectAllDisplayFields() {
	selectedFields.clear()
	DISPLAY_FIELDS.forEach((field) => {
		selectedFields.add(field.key)
	})
	renderFieldControls()
	renderGames()
}

function deselectAllDisplayFields() {
	selectedFields.clear()
	renderFieldControls()
	renderGames()
}

async function loadGames() {
	await loadRelationLookupMaps()

	const { data, error } = await supabase
		.from('Game')
		.select('*')
		.order('created_at', { ascending: false })

	if (error) {
		console.error('Error loading games:', error)
		gamesList.innerHTML = `<div class="col-12"><div class="alert alert-danger mb-0">Failed to load games: ${error.message}</div></div>`
		return
	}

	games = data || []
	renderGames()
}

renderFieldControls()
selectAllButton.addEventListener('click', selectAllDisplayFields)
deselectAllButton.addEventListener('click', deselectAllDisplayFields)
void loadGames()
