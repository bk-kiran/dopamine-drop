'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { Zap, Flame, Trophy, CheckCircle2, Upload, Edit2, X, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { redirect } from 'next/navigation'
import { LevelCard } from '@/components/level-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CropAvatarModal } from '@/components/crop-avatar-modal'
import { useToast } from '@/components/ui/use-toast'

const LEVELS = [
  { level: 1, name: 'Freshman', minPoints: 0 },
  { level: 2, name: 'Sophomore', minPoints: 100 },
  { level: 3, name: 'Junior', minPoints: 250 },
  { level: 4, name: 'Senior', minPoints: 500 },
  { level: 5, name: 'Graduate', minPoints: 1000 },
  { level: 6, name: 'PhD Student', minPoints: 2000 },
  { level: 7, name: 'Professor', minPoints: 3500 },
]

export default function ProfilePage() {
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null)
  const [supabaseEmail, setSupabaseEmail] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Get Supabase user
  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        redirect('/login')
      }

      if (user) {
        setSupabaseUserId(user.id)
        setSupabaseEmail(user.email || null)
      }
    }
    getUser()
  }, [])

  // Get user data
  const userData = useQuery(
    api.users.getUserBySupabaseId,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get profile stats
  const profileStats = useQuery(
    api.users.getProfileStats,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get level data
  const levelData = useQuery(
    api.users.getLevel,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get user rewards
  const userRewards = useQuery(
    api.rewards.getUserRewardsBySupabaseId,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Get avatar URL
  const avatarUrl = useQuery(
    api.users.getAvatarUrl,
    supabaseUserId ? { supabaseId: supabaseUserId } : 'skip'
  )

  // Mutations
  const updateDisplayName = useMutation(api.users.updateDisplayName)
  const updateAvatar = useMutation(api.users.updateAvatar)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)

  // Get initials
  const getInitials = () => {
    if (!userData?.displayName) return '?'
    const names = userData.displayName.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase()
    }
    return names[0][0].toUpperCase()
  }

  // Handle name edit
  const handleStartEdit = () => {
    setEditedName(userData?.displayName || '')
    setIsEditingName(true)
  }

  const handleSaveName = async () => {
    if (!supabaseUserId || !editedName.trim()) return

    try {
      await updateDisplayName({
        supabaseId: supabaseUserId,
        displayName: editedName.trim(),
      })
      setIsEditingName(false)
    } catch (error) {
      console.error('Error updating name:', error)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  // Handle avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    // Read file as base64 for crop preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setRawImageSrc(result)
      setShowCropModal(true)
    }
    reader.readAsDataURL(file)

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropSave = async (croppedBlob: Blob) => {
    if (!supabaseUserId) return

    try {
      setIsUploading(true)

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl()

      // Upload cropped blob
      const result = await fetch(uploadUrl, {
        method: 'POST',
        body: croppedBlob,
      })

      if (!result.ok) {
        throw new Error('Upload failed')
      }

      const { storageId } = await result.json()

      // Update user avatar
      await updateAvatar({
        supabaseId: supabaseUserId,
        storageId,
      })

      // Close modal and clear state
      setShowCropModal(false)
      setRawImageSrc(null)

      // Show success toast
      toast({
        title: 'Profile photo updated',
        description: 'Your profile photo has been successfully updated.',
      })
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload profile photo. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleCropCancel = () => {
    setShowCropModal(false)
    setRawImageSrc(null)
  }

  // Get current level for roadmap
  const currentLevel = levelData?.currentLevel || 1

  // Loading state
  if (!userData || !profileStats || !levelData || !supabaseUserId) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-[var(--text-muted)]">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Profile</h1>
        <p className="text-[var(--text-muted)]">Manage your account and view your progress</p>
      </div>

      {/* Profile Hero Card */}
      <div className="px-8 py-6 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleAvatarClick}
              disabled={isUploading}
              className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center border-4 border-purple-500/30 hover:border-purple-400/50 transition-all duration-200 cursor-pointer overflow-hidden"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-white">{getInitials()}</span>
              )}

              {/* Upload overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="w-8 h-8 text-white" />
              </div>

              {/* Upload progress */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="flex-1">
            {/* Name */}
            {isEditingName ? (
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="max-w-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold text-[var(--text-primary)]">
                  {userData.displayName || 'Student'}
                </h2>
                <button
                  onClick={handleStartEdit}
                  className="p-2 rounded-lg hover:bg-purple-500/10 text-[var(--text-muted)] hover:text-purple-400 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-[var(--text-muted)] mb-3">{supabaseEmail}</p>

            <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-sm font-bold uppercase tracking-wider border border-purple-500/30">
              Premium Student
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Points */}
        <div className="flex items-center gap-4 px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="p-3 rounded-xl bg-purple-500/10">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{profileStats.totalPoints}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Total Points</p>
          </div>
        </div>

        {/* Current Streak */}
        <div className="flex items-center gap-4 px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="p-3 rounded-xl bg-orange-500/10">
            <Flame className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{profileStats.streakCount}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Current Streak</p>
          </div>
        </div>

        {/* Longest Streak */}
        <div className="flex items-center gap-4 px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="p-3 rounded-xl bg-yellow-500/10">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{profileStats.longestStreak}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Longest Streak</p>
          </div>
        </div>

        {/* Assignments Submitted */}
        <div className="flex items-center gap-4 px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="p-3 rounded-xl bg-green-500/10">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{profileStats.submittedCount}</p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Submitted</p>
          </div>
        </div>
      </div>

      {/* Level Progress Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Level Progress</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Level Card */}
          <LevelCard supabaseUserId={supabaseUserId} />

          {/* Levels Roadmap */}
          <div className="px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">
              Levels Roadmap
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {LEVELS.map((level) => {
                const isCompleted = currentLevel > level.level
                const isCurrent = currentLevel === level.level
                const isFuture = currentLevel < level.level

                return (
                  <motion.div
                    key={level.level}
                    whileHover={{ scale: 1.05 }}
                    className={`flex-shrink-0 px-4 py-3 rounded-xl border-2 transition-all ${
                      isCurrent
                        ? 'bg-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/20'
                        : isCompleted
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-white/5 border-white/10 opacity-50'
                    }`}
                  >
                    <div className="text-center">
                      <p className={`text-2xl font-bold mb-1 ${
                        isCurrent ? 'text-purple-400' : isCompleted ? 'text-purple-300' : 'text-[var(--text-muted)]'
                      }`}>
                        {level.level}
                      </p>
                      <p className={`text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                        isCurrent ? 'text-purple-400' : isCompleted ? 'text-purple-300' : 'text-[var(--text-muted)]'
                      }`}>
                        {level.name}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-purple-400 mt-1">Current</p>
                      )}
                      {isCompleted && (
                        <div className="mt-1 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Rewards Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">My Rewards</h2>

        {userRewards && userRewards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userRewards.map((userReward) => (
              <motion.div
                key={userReward._id}
                whileHover={{ scale: 1.02 }}
                className="p-6 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] hover:border-purple-400/30 transition-all"
              >
                {userReward.isRevealed ? (
                  <>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                      {userReward.reward?.name || 'Unknown Reward'}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] mb-3">
                      {userReward.reward?.description || ''}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        userReward.reward?.rarity === 'legendary'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : userReward.reward?.rarity === 'rare'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {userReward.reward?.rarity || 'common'}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {userReward.earnedAt
                          ? new Date(userReward.earnedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Recently earned'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-purple-500/10 border-2 border-purple-500/30 flex items-center justify-center">
                      <span className="text-4xl">?</span>
                    </div>
                    <p className="text-sm font-bold text-purple-400 uppercase tracking-wide">
                      Tap to reveal
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-30" />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No rewards yet</h3>
            <p className="text-[var(--text-muted)]">
              Complete assignments to earn points and unlock rewards!
            </p>
          </div>
        )}
      </div>

      {/* Crop Avatar Modal */}
      {showCropModal && rawImageSrc && (
        <CropAvatarModal
          imageSrc={rawImageSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}
