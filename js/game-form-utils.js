export const GAME_TABLE = 'Game'
export const IMAGE_BUCKET = 'game-image'
export const CARD_IMAGE_PATH_PREFIX = 'game-card-image'
export const BOX_IMAGE_PATH_PREFIX = 'game-box-image'

export function parseNumber(value) {
	if (value === null || value === undefined || value === '') {
		return null
	}

	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

export function parseInteger(value) {
	const parsed = parseNumber(value)
	return parsed === null ? null : Math.trunc(parsed)
}

export function parseIdArray(csvValue) {
	return String(csvValue || '')
		.split(',')
		.map((value) => Number(value.trim()))
		.filter((value) => Number.isInteger(value))
}

export function sanitizeFilename(fileName) {
	return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function clearImagePreview(imagePreviewElement, previewUrlState) {
	if (previewUrlState.value) {
		URL.revokeObjectURL(previewUrlState.value)
		previewUrlState.value = null
	}

	if (imagePreviewElement) {
		imagePreviewElement.removeAttribute('src')
		imagePreviewElement.classList.add('d-none')
	}
}

export function setImagePreviewSource(imagePreviewElement, src) {
	if (!imagePreviewElement || !src) {
		return
	}

	imagePreviewElement.src = src
	imagePreviewElement.classList.remove('d-none')
}

export function updateImagePreview(file, imagePreviewElement, previewUrlState) {
	clearImagePreview(imagePreviewElement, previewUrlState)

	if (!imagePreviewElement || !file || !file.type.startsWith('image/')) {
		return
	}

	previewUrlState.value = URL.createObjectURL(file)
	imagePreviewElement.src = previewUrlState.value
	imagePreviewElement.classList.remove('d-none')
}

export async function uploadImageIfSelected(supabase, imageInput, pathPrefix, imageLabel) {
	if (!imageInput || !imageInput.files || !imageInput.files.length) {
		return null
	}

	const file = imageInput.files[0]
	const timestamp = Date.now()
	const safeFileName = sanitizeFilename(file.name)
	const filePath = `${pathPrefix}/${timestamp}-${safeFileName}`

	const { data, error } = await supabase.storage
		.from(IMAGE_BUCKET)
		.upload(filePath, file, {
			upsert: false,
			contentType: file.type || 'application/octet-stream'
		})

	if (error) {
		throw new Error(`${imageLabel} upload failed: ${error.message}`)
	}

	return data.path
}

export function buildGamePayload(formData, cardImagePath, boxImagePath) {

	return {
		name: String(formData.get('name') || '').trim(),
		players_min: parseInteger(formData.get('players_min')),
		players_max: parseInteger(formData.get('players_max')),
		owner: String(formData.get('owner') || '').trim() || null,
		time_min: parseInteger(formData.get('game_time_min')),
		time_max: parseInteger(formData.get('game_time_max')),
		year_published: parseInteger(formData.get('year_published')),
		cost: parseNumber(formData.get('cost')),
		game_complexity: String(formData.get('game_complexity') || '').trim() || null,
		recommended_age: parseInteger(formData.get('recommended_age')),
		expansion: String(formData.get('expansion_or_base') || '').trim() || null,
		condition: String(formData.get('condition_status') || '').trim() || null,
		language: String(formData.get('language') || '').trim() || null,
		game_designer: String(formData.get('game_designer') || '').trim() || null,
		publisher: String(formData.get('publisher') || '').trim() || null,
		description: String(formData.get('description') || '').trim() || null,
		more_info: String(formData.get('game_more_info') || '').trim() || null,
		vibes: parseIdArray(formData.get('vibes') || formData.get('tags')),
		theme: parseIdArray(formData.get('theme')),
		mechanics: parseIdArray(formData.get('game_mechanics')),
		card_image_path: cardImagePath || null,
		box_image_path: boxImagePath || null
	}
}

export function toPublicImageUrl(supabaseUrl, imagePath) {
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
	return `${supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${normalizedPath}`
}