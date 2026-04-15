/**
 * Comprime uma imagem client-side usando Canvas API (sem dependencia externa).
 *
 * Redimensiona para no maximo maxDimension (px) no lado maior, mantendo proporcao.
 * Reexporta como JPEG (ou PNG se for PNG com transparencia).
 *
 * Tipica reducao: foto de iPhone (5MB) vira 400-600KB.
 *
 * Porque isso existe: fotos de celular costumam ter 3-8MB. Server actions do
 * Next.js tem limite de body de 10MB (configurado em next.config.ts). Upload
 * direto do arquivo raw costuma estourar o limite e retornar erro generico
 * "An unexpected response was received from the server".
 */
export async function compressImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.85 } = options

  // So processa imagens
  if (!file.type.startsWith('image/')) return file

  // SVG nao pode ser comprimido por canvas
  if (file.type === 'image/svg+xml') return file

  // HEIC/HEIF (iPhone) nao e suportado pelo canvas na maioria dos browsers.
  // Nesse caso retornamos o arquivo original - se exceder o limite, a
  // mensagem de erro vai orientar o usuario a escolher outro formato.
  if (file.type === 'image/heic' || file.type === 'image/heif') return file

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler imagem'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Falha ao decodificar imagem'))
      img.onload = () => {
        // Calcula novas dimensoes mantendo proporcao
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas nao suportado'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // PNG mantem PNG (pode ter transparencia); resto vira JPEG
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const outputExt = outputType === 'image/png' ? 'png' : 'jpg'

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Falha ao gerar imagem comprimida'))
              return
            }
            // Se a compressao nao reduziu, usa o original
            if (blob.size >= file.size) {
              resolve(file)
              return
            }
            const baseName = file.name.replace(/\.[^.]+$/, '')
            const newFile = new File([blob], `${baseName}.${outputExt}`, {
              type: outputType,
              lastModified: Date.now(),
            })
            resolve(newFile)
          },
          outputType,
          quality
        )
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Substitui o arquivo selecionado em um <input type="file"> pelo arquivo
 * comprimido, para que o FormData do submit pegue a versao comprimida.
 *
 * Uso tipico:
 *   const compressed = await compressImage(file)
 *   replaceInputFile(fileInputRef.current, compressed)
 */
export function replaceInputFile(input: HTMLInputElement | null, file: File): void {
  if (!input) return
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
}
