const apiErrorMessages = {
  unauthorized: 'Debes iniciar sesión.',
  forbidden: 'No tienes permiso para hacer esto.',
  suspended: 'Tu cuenta está suspendida. Contacta con la organización.',
  notFound: 'No encontrado.',
  requiredId: 'Falta el identificador.',
  duplicateRecord: 'Ya existe un registro con esos datos.',
  emailAlreadyExists: 'Ya existe un usuario con ese correo.',
  committeeNotFound: 'Comisión no encontrada.',
  committeeHasMembers: 'No se puede eliminar una comisión con miembros asignados.',
  groupNotFound: 'Grupo parlamentario no encontrado.',
  groupHasMembers: 'No se puede eliminar un grupo con miembros asignados.',
  groupHasBallots:
    'No se puede eliminar un grupo que aparece en votos ya emitidos. Se perdería la adscripción con la que votaron.',
  committeeHasBallots:
    'No se puede eliminar una comisión que aparece en votos ya emitidos. Se perdería la adscripción con la que votaron.',
  userNotFound: 'Usuario no encontrado.',
  cannotSuspendSelf: 'No puedes suspender tu propia cuenta.',
  cannotDeleteSelf: 'No puedes eliminar tu propia cuenta.',
  cannotDemoteSelf: 'No puedes quitarte el rol de administrador.',
  userHasBallots:
    'Este usuario ya ha votado: no se puede eliminar. Suspende la cuenta para retirarle el acceso.',
  delegateNeedsCommitteeAndGroup: 'Los participantes deben tener comisión y grupo parlamentario.',
  committeeHasVotes:
    'No se puede eliminar una comisión con votaciones. Elimina antes sus votaciones.',
  reservedSlug: 'Ese identificador está reservado para el Pleno.',
  voteLocked:
    'La votación ya tiene votos: no se pueden cambiar sus condiciones. Duplícala o borra los votos.',
  voteOpenLocked: 'La votación está abierta: ciérrala antes de cambiar sus condiciones.',
  voteResetWhileOpen: 'Cierra la votación antes de borrar los votos.',
  csvTooLarge: 'El archivo supera el límite (1 MB o 500 filas).',
  voteNotFound: 'Votación no encontrada.',
  voteAlreadyOpen: 'La votación ya está abierta.',
  voteAlreadyClosed: 'La votación ya está cerrada.',
  voteNotOpen: 'La votación no está abierta.',
  voteMissingOptions: 'La votación necesita al menos una opción para abrirse.',
  voteNoWinningOption: 'Al menos una opción debe computar para el resultado.',
  voteScheduleOrder: 'La hora de cierre debe ser posterior a la de apertura.',
  voteHiddenOpenBlocked: 'No se puede abrir una votación oculta.',
  voteVisibleOpenLocked: 'No se puede ocultar una votación abierta. Ciérrala antes.',
  voteChangeNotAllowed: 'Esta votación no permite cambiar el voto.',
  voteNotEligible: 'No puedes votar en esta votación.',
  voteNoCommittee: 'No tienes comisión asignada. Contacta con la organización.',
  optionNotFound: 'Opción no encontrada.',
  optionChangeWhileOpen: 'No se pueden cambiar las opciones con la votación abierta.',
  optionHasBallots: 'No se puede eliminar una opción que ya tiene votos.',
  imageMissingFile: 'No se ha enviado ninguna imagen.',
  imageInvalidFile: 'El archivo está dañado o no se puede leer como imagen.',
  imageUnsupportedFormat:
    'Formato no admitido. Usa jpg, png, webp o avif. Las fotos HEIC del iPhone no valen: compártelas o expórtalas como JPG.',
  imageTooLarge: 'La imagen supera el tamaño máximo (8 MB).',
  imageTooSmallAvatar: 'La foto es demasiado pequeña. Mínimo 64 × 64 píxeles.',
  imageTooSmallLogo: 'El logo es demasiado pequeño. Mínimo 64 píxeles de lado.',
  imageTooSmallCover:
    'La portada es demasiado pequeña. Mínimo 800 × 450 píxeles, y se recortará a 16:9.',
  imageSaveFailed: 'No se ha podido guardar la imagen.',
  imageNotFound: 'Imagen no encontrada.',
  csvMissingFile: 'No se ha enviado ningún archivo CSV.',
  csvEmpty: 'El CSV no contiene filas.',
  mailNotConfigured: 'El envío de correo no está configurado en el servidor.',
  mailSendFailed: 'No se ha podido enviar el correo.',
} as const

export type ApiErrorMessageKey = keyof typeof apiErrorMessages

export function getApiErrorMessage(key: ApiErrorMessageKey) {
  return apiErrorMessages[key]
}

export function apiError(statusCode: number, key: ApiErrorMessageKey, data?: unknown) {
  return createError({ statusCode, message: apiErrorMessages[key], data })
}
