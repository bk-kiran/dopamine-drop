'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CropAvatarModalProps {
  open: boolean
  onClose: () => void
  imageSrc: string
  onSave: (croppedBlob: Blob) => Promise<void>
}

export function CropAvatarModal({ open, onClose, imageSrc, onSave }: CropAvatarModalProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 25,
    y: 25,
    width: 50,
    height: 50,
  })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [isUploading, setIsUploading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const getCroppedImg = useCallback(
    async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('No 2d context')
      }

      // Set canvas size to 300x300 for consistent avatar size
      const size = 300
      canvas.width = size
      canvas.height = size

      // Draw the cropped image onto the canvas
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        size,
        size
      )

      // Convert canvas to blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'))
              return
            }
            resolve(blob)
          },
          'image/jpeg',
          0.9
        )
      })
    },
    []
  )

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return

    try {
      setIsUploading(true)
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop)
      await onSave(croppedBlob)
    } catch (error) {
      console.error('Error cropping image:', error)
      alert('Failed to crop image')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[var(--glass-bg)] backdrop-blur-md border-[var(--glass-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">Crop Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop={true}
            minWidth={100}
            minHeight={100}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              className="max-w-full"
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUploading || !completedCrop}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {isUploading ? 'Uploading...' : 'Save Photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
