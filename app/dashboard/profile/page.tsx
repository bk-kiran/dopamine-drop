'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { createClient } from '@/lib/supabase/client'
import { Zap, Flame, Trophy, CheckCircle2, Upload, Edit2, X, Check, Lock, Star, Moon, Shield, Crown, Sun, Dumbbell, Target, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { redirect, useRouter } from 'next/navigation'
import { LevelCard } from '@/components/level-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CropAvatarModal } from '@/components/crop-avatar-modal'
import { useToast } from '@/components/ui/use-toast'

const ACHIEVEMENT_ICON_MAP: Record<string, React.ElementType> = {
  Star, Moon, Zap, Shield, Flame, Trophy, Crown, Sun, Dumbbell, Target,
}

const ACHIEVEMENT_COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', iconBg: 'bg-yellow-500/20' },
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/40',   text: 'text-blue-400',   iconBg: 'bg-blue-500/20' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/40',  text: 'text-green-400',  iconBg: 'bg-green-500/20' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-400', iconBg: 'bg-orange-500/20' },
  red:    { bg: 'bg-red-500/10',    border: 'border-red-500/40',    text: 'text-red-400',    iconBg: 'bg-red-500/20' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/40', text: 'text-purple-400', iconBg: 'bg-purple-500/20' },
  amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/40',  text: 'text-amber-400',  iconBg: 'bg-amber-500/20' },
  gold:   { bg: 'bg-yellow-500/10', border: 'border-yellow-400/50', text: 'text-yellow-300', iconBg: 'bg-yellow-400/20' },
}

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
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()

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

  // Get achievements
  const userAchievements = useQuery(
    api.achievements.getUserAchievements,
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
  const setXpMultiplierDay = useMutation(api.users.setXpMultiplierDay)

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

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error logging out:', error)
      setIsLoggingOut(false)
    }
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Profile</h1>
          <p className="text-[var(--text-muted)]">Manage your account and view your progress</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all duration-200 disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? 'Signing out...' : 'Sign out'}
        </button>
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

      {/* Achievements Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Achievements</h2>
          {userAchievements && (
            <span className="text-sm text-[var(--text-muted)]">
              {userAchievements.filter((a: any) => a.unlocked).length}/{userAchievements.length} unlocked
            </span>
          )}
        </div>

        {userAchievements && userAchievements.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {userAchievements.map((achievement: any) => {
              const colors = ACHIEVEMENT_COLOR_MAP[achievement.color] ?? ACHIEVEMENT_COLOR_MAP.purple
              const IconComponent = ACHIEVEMENT_ICON_MAP[achievement.icon] ?? Star

              if (achievement.unlocked) {
                return (
                  <motion.div
                    key={achievement._id}
                    whileHover={{ scale: 1.03 }}
                    className={`p-5 rounded-2xl border backdrop-blur-md transition-all ${colors.bg} ${colors.border}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${colors.iconBg} border ${colors.border}`}>
                      <IconComponent className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <p className={`text-sm font-bold mb-1 ${colors.text}`}>{achievement.name}</p>
                    <p className="text-xs text-[var(--text-muted)] leading-snug mb-2">
                      {achievement.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
                        +{achievement.bonusPoints} pts
                      </span>
                      {achievement.unlockedAt && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {new Date(achievement.unlockedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              }

              // Locked state
              return (
                <div
                  key={achievement._id}
                  className="p-5 rounded-2xl border bg-white/3 border-white/8 opacity-50"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-white/5 border border-white/10 relative">
                    <IconComponent className="w-6 h-6 text-[var(--text-muted)] grayscale" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--glass-bg)] border border-white/20 flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                    </div>
                  </div>
                  <p className="text-sm font-bold mb-1 text-[var(--text-muted)]">{achievement.name}</p>
                  <p className="text-xs text-[var(--text-muted)] leading-snug mb-2 opacity-70">???</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    +{achievement.bonusPoints} pts
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
            <p className="text-[var(--text-muted)] text-sm">
              Achievements will appear here once the pool is seeded.
            </p>
          </div>
        )}
      </div>

      {/* 2x XP Day Settings */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">2x XP Day</h2>
        <div className="px-6 py-5 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-purple-400 fill-purple-400/30" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
                {userData?.xpMultiplierDay !== undefined
                  ? `Active on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(userData.xpMultiplierDay)]}`
                  : 'Not set'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                All points earned on this day are doubled. Choose wisely!
              </p>
              <div className="flex flex-wrap gap-2">
                {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((label, i) => {
                  // JS getDay(): 0=Sun,1=Mon…6=Sat — map display order Mon–Sun to day numbers
                  const dayNum = String(i === 6 ? 0 : i + 1)
                  const isSelected = userData?.xpMultiplierDay === dayNum
                  const isToday = String(new Date().getDay()) === dayNum
                  return (
                    <button
                      key={label}
                      onClick={() =>
                        setXpMultiplierDay({
                          supabaseId: supabaseUserId!,
                          day: isSelected ? undefined : dayNum,
                        }).catch(console.error)
                      }
                      disabled={!supabaseUserId}
                      className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${
                        isSelected
                          ? 'bg-purple-500/30 border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                          : 'bg-white/5 border-white/10 text-[var(--text-muted)] hover:border-purple-500/40 hover:text-purple-400'
                      }`}
                    >
                      {label}
                      {isToday && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 border border-[var(--glass-bg)]" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
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
