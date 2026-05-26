import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://pedtyonlklzbyikiywru.supabase.co'
const supabaseKey = 'sb_publishable_oLffRxc_yv8J4ZDTuSSPXw_wQtNye15'
const supabase = createClient(supabaseUrl, supabaseKey)
const publicBucketBaseUrl = `${supabaseUrl}/storage/v1/object/public/game-image/`

const controlsContainer = document.getElementById('displayFieldControls')
const gamesList = document.getElementById('gamesList')
const selectAllButton = document.getElementById('selectAllDisplayFields')
const deselectAllButton = document.getElementById('deselectAllDisplayFields')

if (!controlsContainer || !gamesList || !selectAllButton || !deselectAllButton) {
	throw new Error('Required display settings elements are missing in games.html')
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
		key: 'hours',
		label: 'Hours',
		getValue: (game) => {
			const min = game.hours_min
			const max = game.hours_max
			return formatKnownRange(min, max, 'Minimum play time', 'Maximum play time')
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
		key: 'website',
		label: 'Website',
		getValue: (game) => game.web_url
	},
	{
		key: 'image',
		label: 'Image',
		getValue: (game) => game.image_path
	}
]

const selectedFields = new Set(['players', 'owner'])
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

	if (field.key === 'website') {
		const url = String(value)
		return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
	}

	return String(value)
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
		const imageUrl = imageEnabled ? toPublicImageUrl(game.image_path) : ''

		const details = DISPLAY_FIELDS
			.filter((field) => selectedFields.has(field.key) && field.key !== 'image')
			.map((field) => {
				const formatted = formatValue(field, field.getValue(game))
				if (!formatted) {
					return ''
				}
				return `<li class="list-group-item"><strong>${field.label}:</strong> ${formatted}</li>`
			})
			.filter(Boolean)
			.join('')

		card.innerHTML = `
			<div class="card h-100 shadow-sm game-card" ${imageUrl ? `style="background-image: url('${imageUrl}')"` : ''}>
				<div class="card-body">
					<div class="game-card-title-row mb-3">
						<h3 class="h5 card-title mb-0">${game.name || 'Unnamed game'}</h3>
						<a class="edit-game-link" href="edit-game.html" aria-label="Edit ${game.name || 'game'}" title="Edit game">
							<img src="svg/pencil-square.svg" alt="" width="18" height="18">
						</a>
					</div>
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
