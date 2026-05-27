import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
	buildGamePayload,
	CARD_IMAGE_PATH_PREFIX,
	clearImagePreview,
	BOX_IMAGE_PATH_PREFIX,
	GAME_TABLE,
	uploadImageIfSelected,
	updateImagePreview
} from './game-form-utils.js'

const supabaseUrl = 'https://pedtyonlklzbyikiywru.supabase.co'
const supabaseKey = 'sb_publishable_oLffRxc_yv8J4ZDTuSSPXw_wQtNye15'

const supabase = createClient(supabaseUrl, supabaseKey)

const form = document.getElementById('gameLibraryForm')
const cardImageInput = document.getElementById('cardImgInp')
const cardImageFileNameInput = document.querySelector('input[name="card_img"]')
const cardImagePreview = document.getElementById('card-img-upload')
const boxImageInput = document.getElementById('boxImgInp')
const boxImageFileNameInput = document.querySelector('input[name="box_img"]')
const boxImagePreview = document.getElementById('box-img-upload')

let cardImagePreviewUrl = null
let boxImagePreviewUrl = null
const cardImagePreviewState = {
	get value() {
		return cardImagePreviewUrl
	},
	set value(newValue) {
		cardImagePreviewUrl = newValue
	}
}
const boxImagePreviewState = {
	get value() {
		return boxImagePreviewUrl
	},
	set value(newValue) {
		boxImagePreviewUrl = newValue
	}
}

if (!form) {
	throw new Error('Form #gameLibraryForm not found in add-game.html')
}

async function uploadCardImageIfSelected() {
	return uploadImageIfSelected(supabase, cardImageInput, CARD_IMAGE_PATH_PREFIX, 'Card image')
}

async function uploadBoxImageIfSelected() {
	return uploadImageIfSelected(supabase, boxImageInput, BOX_IMAGE_PATH_PREFIX, 'Box image')
}

async function submitGame(event) {
	event.preventDefault()

	const submitButton = form.querySelector('button[type="submit"]')
	if (submitButton) {
		submitButton.disabled = true
		submitButton.textContent = 'Saving...'
	}

	try {
		const formData = new FormData(form)
		const cardImagePath = await uploadCardImageIfSelected()
		const boxImagePath = await uploadBoxImageIfSelected()
		const payload = buildGamePayload(formData, cardImagePath, boxImagePath)

		const { error } = await supabase
			.from(GAME_TABLE)
			.insert([payload])

		if (error) {
			throw new Error(`Game insert failed: ${error.message}`)
		}

		window.alert('Game saved successfully.')
		form.reset()
		form.dispatchEvent(new CustomEvent('picker:clear'))

		// Clear file name mirror input after successful reset.
		if (cardImageFileNameInput) {
			cardImageFileNameInput.value = ''
		}

		if (boxImageFileNameInput) {
			boxImageFileNameInput.value = ''
		}

		clearImagePreview(cardImagePreview, cardImagePreviewState)
		clearImagePreview(boxImagePreview, boxImagePreviewState)
	} catch (error) {
		console.error(error)
		window.alert(error instanceof Error ? error.message : 'Failed to save game.')
	} finally {
		if (submitButton) {
			submitButton.disabled = false
			submitButton.textContent = 'Save Game'
		}
	}
}

if (cardImageInput && cardImageFileNameInput) {
	cardImageInput.addEventListener('change', () => {
		const selectedFile = cardImageInput.files && cardImageInput.files[0] ? cardImageInput.files[0] : null
		const fileName = selectedFile ? selectedFile.name : ''
		cardImageFileNameInput.value = fileName
		updateImagePreview(selectedFile, cardImagePreview, cardImagePreviewState)
	})
}

if (boxImageInput && boxImageFileNameInput) {
	boxImageInput.addEventListener('change', () => {
		const selectedFile = boxImageInput.files && boxImageInput.files[0] ? boxImageInput.files[0] : null
		const fileName = selectedFile ? selectedFile.name : ''
		boxImageFileNameInput.value = fileName
		updateImagePreview(selectedFile, boxImagePreview, boxImagePreviewState)
	})
}

form.addEventListener('submit', submitGame)
