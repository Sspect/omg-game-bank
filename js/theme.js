import { supabase } from './supabase.js'
import { setupTagPicker } from './tags.js'

const THEME_TABLE = 'Theme'

const themeSearchInput = document.getElementById('themeSearchInput')
const themeDropdown = document.getElementById('themeDropdown')
const selectedThemesContainer = document.getElementById('selectedThemes')
const themesHiddenInput = document.getElementById('theme')
const themePicker = document.getElementById('themePicker')

if (!themeSearchInput || !themeDropdown || !selectedThemesContainer || !themesHiddenInput || !themePicker) {
	throw new Error('Theme picker elements not found in add-game.html')
}

setupTagPicker({
	supabase,
	tableName: THEME_TABLE,
	itemLabel: 'theme',
	itemLabelPlural: 'themes',
	searchInput: themeSearchInput,
	dropdown: themeDropdown,
	selectedContainer: selectedThemesContainer,
	hiddenInput: themesHiddenInput,
	picker: themePicker,
	form: document.getElementById('gameLibraryForm'),
	prefillDetailKeys: ['theme'],
	nameColumns: ['name', 'theme', 'theme_name', 'title', 'label'],
	idColumns: ['id', 'theme_id', 'uuid']
})
