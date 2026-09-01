/**
 * Comprime uma imagem client-side usando Canvas API (sem dependencia externa).
 *
 * POR QUE ISSO EXISTE, e qual e o limite que REALMENTE morde:
 *
 * Foto de celular tem 3-8MB. O upload vai por Server Action, e a Vercel impõe
 * um teto de ~4,5MB no CORPO da requisicao das funcoes serverless. Esse teto e
 * da PLATAFORMA: o `serverActions.bodySizeLimit` do next.config (25mb) NAO o
 * levanta. Passou de ~4,5MB, a requisicao e recusada antes de chegar no nosso
 * codigo, e o usuario ve "An error occurred in the Server Components render",
 * sem pista nenhuma do motivo.
 *
 * Evidencia: das 411 imagens de produto ja no storage, a maior tem 4344 kB e
 * NENHUMA passa de 4,5MB — a distribuicao e censurada exatamente no teto.
 */

/** Margem de seguranca sob o teto de ~4,5MB da Vercel (sobra pro resto do form). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/** Alvo perseguido pela compressao. Bem abaixo do teto, pra subir rapido em 3G. */
const TARGET_BYTES = 1.5 * 1024 * 1024

/** Tentativas sucessivas quando a 1a passada ainda fica grande demais. */
const PASSADAS: { maxDimension: number; quality: number }[] = [
  { maxDimension: 1600, quality: 0.85 },
  { maxDimension: 1400, quality: 0.7 },
  { maxDimension: 1100, quality: 0.6 },
  { maxDimension: 900, quality: 0.5 },
]

type Fonte = ImageBitmap | HTMLImageElement

/**
 * Decodifica o arquivo. Usa createImageBitmap quando disponivel: alem de ser
 * mais leve em memoria que ler o arquivo inteiro como data URL (base64 incha
 * ~33% e derruba celular fraco), ele aproveita os decoders nativos — e e por
 * isso que HEIC de iPhone funciona no Safari, que e justamente de onde vem.
 */
async function decodificar(file: File): Promise<Fonte> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Formato que este browser nao decodifica — tenta o caminho do <img>.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Falha ao decodificar imagem'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function dimensoes(fonte: Fonte): { width: number; height: number } {
  return fonte instanceof HTMLImageElement
    ? { width: fonte.naturalWidth || fonte.width, height: fonte.naturalHeight || fonte.height }
    : { width: fonte.width, height: fonte.height }
}

function desenhar(
  fonte: Fonte,
  maxDimension: number,
  outputType: string,
  quality: number,
): Promise<Blob | null> {
  let { width, height } = dimensoes(fonte)
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
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(fonte, 0, 0, width, height)

  return new Promise((resolve) => canvas.toBlob(resolve, outputType, quality))
}

export async function compressImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  // So processa imagens; SVG e vetor e nao passa por canvas.
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/svg+xml') return file

  let fonte: Fonte
  try {
    fonte = await decodificar(file)
  } catch {
    // Nao deu pra decodificar (ex.: HEIC fora do Safari). Devolve o original —
    // quem chama aplica o guarda de tamanho e avisa o usuario direito.
    return file
  }

  try {
    // PNG so continua PNG se o chamador nao pediu nada: PNG de foto fica enorme.
    // Como o alvo aqui e foto de produto, JPEG e o padrao pra tudo que nao for
    // PNG (que pode ter transparencia).
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const outputExt = outputType === 'image/png' ? 'png' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagem'

    // Se o chamador pediu dimensao/qualidade especificas, respeita e nao itera.
    const passadas =
      options.maxDimension !== undefined || options.quality !== undefined
        ? [{ maxDimension: options.maxDimension ?? 1600, quality: options.quality ?? 0.85 }]
        : PASSADAS

    let melhor: Blob | null = null
    for (const p of passadas) {
      const blob = await desenhar(fonte, p.maxDimension, outputType, p.quality)
      if (!blob) break
      if (!melhor || blob.size < melhor.size) melhor = blob
      // Bom o suficiente: para de tentar e economiza CPU do celular.
      if (blob.size <= TARGET_BYTES) break
    }

    if (!melhor) return file
    // Comprimir aumentou o arquivo (acontece com PNG pequeno): fica com o original.
    if (melhor.size >= file.size) return file

    return new File([melhor], `${baseName}.${outputExt}`, {
      type: outputType,
      lastModified: Date.now(),
    })
  } finally {
    if (!(fonte instanceof HTMLImageElement)) fonte.close()
  }
}

/**
 * Substitui o arquivo selecionado em um <input type="file"> pelo comprimido.
 *
 * ATENCAO: preferir passar o File comprimido direto no FormData
 * (`formData.set('image', arquivo)`). Este helper depende do construtor
 * DataTransfer, que nem todo browser mobile implementa — e quando ele falha,
 * falha em SILENCIO e o arquivo ORIGINAL (grande) e que vai pro servidor.
 * Retorna true se conseguiu.
 */
export function replaceInputFile(input: HTMLInputElement | null, file: File): boolean {
  if (!input) return false
  try {
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    return true
  } catch {
    return false
  }
}
