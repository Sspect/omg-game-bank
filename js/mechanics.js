import { supabase } from './supabase.js'
import { getElementByIdFallback, setupTagPicker } from './tags.js'

const MECHANICS_TABLE = 'Mechanics'

const mechanicSearchInput = document.getElementById('mechanicSearchInput')
const mechanicDropdown = document.getElementById('mechanicDropdown')
const selectedMechanicsContainer = document.getElementById('selectedMechanics')
const mechanicsHiddenInput = getElementByIdFallback(['game_mechanics', 'game_mechanisms'])
const mechanicPicker = document.getElementById('mechanicPicker')

if (!mechanicSearchInput || !mechanicDropdown || !selectedMechanicsContainer || !mechanicsHiddenInput || !mechanicPicker) {
	throw new Error('Mechanics picker elements not found in add-game.html')
}

setupTagPicker({
	supabase,
	tableName: MECHANICS_TABLE,
	itemLabel: 'mechanic',
	itemLabelPlural: 'mechanics',
	searchInput: mechanicSearchInput,
	dropdown: mechanicDropdown,
	selectedContainer: selectedMechanicsContainer,
	hiddenInput: mechanicsHiddenInput,
	picker: mechanicPicker,
	form: document.getElementById('gameLibraryForm'),
	prefillDetailKeys: ['mechanics'],
	nameColumns: ['name', 'mechanic', 'mechanic_name', 'title', 'label'],
	idColumns: ['id', 'mechanic_id', 'uuid']
})
