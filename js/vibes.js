import { supabase } from './supabase.js'
import { getElementByIdFallback, setupTagPicker } from './tags.js'

const VIBES_TABLE = 'Vibes'

const vibeSearchInput = document.getElementById('vibeSearchInput')
const vibeDropdown = document.getElementById('vibeDropdown')
const selectedVibesContainer = document.getElementById('selectedVibes')
const vibesHiddenInput = getElementByIdFallback(['vibes', 'tags'])
const vibePicker = document.getElementById('vibePicker')

if (!vibeSearchInput || !vibeDropdown || !selectedVibesContainer || !vibesHiddenInput || !vibePicker) {
	throw new Error('Vibe picker elements not found in add-game.html')
}

setupTagPicker({
	supabase,
	tableName: VIBES_TABLE,
	itemLabel: 'vibe',
	itemLabelPlural: 'vibes',
	searchInput: vibeSearchInput,
	dropdown: vibeDropdown,
	selectedContainer: selectedVibesContainer,
	hiddenInput: vibesHiddenInput,
	picker: vibePicker,
	form: document.getElementById('gameLibraryForm'),
	prefillDetailKeys: ['vibes', 'tags'],
	nameColumns: ['name', 'vibe', 'vibe_name', 'title', 'label'],
	idColumns: ['id', 'vibe_id', 'uuid']
})