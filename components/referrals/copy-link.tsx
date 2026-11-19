'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** A read-only link with a copy button that falls back to selecting it. */
export function CopyLink({ value, label }: { value: string; label: string }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)

  function flashCopied() {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      flashCopied()
      return
    } catch {
      // `navigator.clipboard` only exists on https (and localhost): on a
      // site served over plain http it is undefined and this throws.
    }
    input.current?.select()
    try {
      // The legacy command still copies the selection on http.
      if (document.execCommand('copy')) flashCopied()
    } catch {
      // Left selected: the visitor can copy it by hand.
    }
  }

  return (
    <div className="flex gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        ref={input}
        id={id}
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="rounded-control font-mono text-sm"
      />
      <Button
        type="button"
        variant="outline"
        onClick={copy}
        className="rounded-pill shrink-0"
      >
        {copied ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  )
}
