'use client'

import {
  ClipboardPasteIcon,
  CopyIcon,
  DownloadIcon,
  UploadIcon,
} from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  MAX_IMPORT_BYTES,
  exportTheme,
  importTheme,
  themeFileName,
} from '@/lib/theme/io'
import type { StoreTheme } from '@/types/app'

/**
 * Moving a theme in and out of the editor.
 *
 * Every inbound path — a file, a pasted clipboard — goes through
 * `importTheme`, which normalises and then validates against the same zod
 * schema the server uses. A file can therefore never put the editor into a
 * state the save would reject, and can never smuggle anything into the page.
 */

export function ThemeIoControls({
  theme,
  storeName,
  onImport,
}: {
  theme: StoreTheme
  storeName: string
  onImport: (theme: StoreTheme) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  function accept(text: string, source: 'archivo' | 'portapapeles') {
    const result = importTheme(text)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    onImport(result.theme)
    toast.success(
      source === 'archivo'
        ? 'Tema importado desde el archivo.'
        : 'Tema pegado desde el portapapeles.',
    )
  }

  function download() {
    const blob = new Blob([exportTheme(theme)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = themeFileName(storeName)
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(exportTheme(theme))
      toast.success('Tema copiado. Pégalo en otra tienda para duplicarlo.')
    } catch {
      toast.error('Tu navegador no nos dejó copiar. Descarga el archivo.')
    }
  }

  async function paste() {
    try {
      accept(await navigator.clipboard.readText(), 'portapapeles')
    } catch {
      toast.error('Tu navegador no nos dejó leer el portapapeles.')
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="rounded-pill"
        onClick={download}
      >
        <DownloadIcon aria-hidden />
        Descargar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="rounded-pill"
        onClick={() => fileRef.current?.click()}
      >
        <UploadIcon aria-hidden />
        Importar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="rounded-pill"
        onClick={() => void copy()}
      >
        <CopyIcon aria-hidden />
        Duplicar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="rounded-pill"
        onClick={() => void paste()}
      >
        <ClipboardPasteIcon aria-hidden />
        Pegar
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Importar un tema desde un archivo"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (file.size > MAX_IMPORT_BYTES) {
            toast.error('El archivo es demasiado grande para ser un tema.')
            return
          }
          void file.text().then((text) => accept(text, 'archivo'))
        }}
      />
    </div>
  )
}
