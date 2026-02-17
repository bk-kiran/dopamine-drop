'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortableSectionProps {
  id: string
  isDraggingAny: boolean
  children: React.ReactNode
}

export function SortableSection({ id, isDraggingAny, children }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isDraggingAny && !isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : 'auto',
    boxShadow: isDragging ? '0 0 20px rgba(168,85,247,0.4)' : undefined,
    position: 'relative',
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      {/* Drag handle — overlaid top-left, only visible on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing text-gray-400 hover:text-purple-400 hover:bg-purple-500/10"
        style={{ touchAction: 'none' }}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Section content with left padding for handle */}
      <div className="pl-8">
        {children}
      </div>
    </div>
  )
}
