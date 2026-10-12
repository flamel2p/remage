// Narrowed from REUI's MIT use-file-upload: adapter validation/ownership stays authoritative.
import { useCallback, useRef, useState, type ChangeEvent, type DragEvent, type InputHTMLAttributes } from 'react'

export function useFileUpload({ onFilesAdded, disabled = false }: { onFilesAdded: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null), depth = useRef(0)
  const [isDragging, setDragging] = useState(false)
  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); if (!disabled && event.dataTransfer.types.includes('Files')) { depth.current++; setDragging(true) } }, [disabled])
  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false) }, [])
  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy' }, [disabled])
  const handleDrop = useCallback((event: DragEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); depth.current = 0; setDragging(false); if (!disabled) onFilesAdded(Array.from(event.dataTransfer.files)) }, [disabled, onFilesAdded])
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (!disabled && files.length) onFilesAdded(files) }, [disabled, onFilesAdded])
  const getInputProps = (props: InputHTMLAttributes<HTMLInputElement> = {}) => ({ ...props, type: 'file' as const, multiple: true, accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp', ref: inputRef, onChange: handleFileChange, disabled })
  return [{ isDragging }, { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, getInputProps, openFileDialog: () => inputRef.current?.click() }] as const
}
