import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

if (!convexUrl) {
  console.error('Error: NEXT_PUBLIC_CONVEX_URL environment variable is not set')
  process.exit(1)
}

const convex = new ConvexHttpClient(convexUrl)

const sampleRewards = [
  // Common rewards (60% drop rate)
  {
    name: '🎨 Theme Customization',
    description: 'Unlock custom color themes for your dashboard',
    rarity: 'common' as const,
  },
  {
    name: '✨ Sparkle Effect',
    description: 'Add sparkles to your dashboard animations',
    rarity: 'common' as const,
  },
  {
    name: '📚 Study Badge',
    description: 'Display a study badge on your profile',
    rarity: 'common' as const,
  },
  {
    name: '⭐ Star Sticker',
    description: 'A shiny star sticker for your achievements',
    rarity: 'common' as const,
  },

  // Rare rewards (30% drop rate)
  {
    name: '🏆 Trophy Badge',
    description: 'Display a golden trophy on your profile',
    rarity: 'rare' as const,
  },
  {
    name: '🎭 Avatar Frame',
    description: 'Premium avatar frame with animated borders',
    rarity: 'rare' as const,
  },
  {
    name: '🎯 Precision Badge',
    description: 'Shows your dedication to timely submissions',
    rarity: 'rare' as const,
  },
  {
    name: '💎 Diamond Effect',
    description: 'Add diamond sparkles to your completed assignments',
    rarity: 'rare' as const,
  },

  // Legendary rewards (10% drop rate)
  {
    name: '👑 Crown Icon',
    description: 'Show off with a legendary golden crown',
    rarity: 'legendary' as const,
  },
  {
    name: '🌟 Star Power',
    description: 'Legendary star effect with particle animations',
    rarity: 'legendary' as const,
  },
  {
    name: '🔥 Flame Aura',
    description: 'Legendary flame effect surrounding your profile',
    rarity: 'legendary' as const,
  },
  {
    name: '⚡ Lightning Strike',
    description: 'Epic lightning animation for your achievements',
    rarity: 'legendary' as const,
  },
]

async function seedRewards() {
  console.log('🌱 Starting rewards seed...')
  console.log(`📍 Using Convex URL: ${convexUrl}`)

  let createdCount = 0

  for (const reward of sampleRewards) {
    try {
      await convex.mutation(api.rewards.create, {
        type: 'virtual' as const,
        name: reward.name,
        description: reward.description,
        rarity: reward.rarity,
        isActive: true,
      })
      console.log(`✅ Created ${reward.rarity} reward: ${reward.name}`)
      createdCount++
    } catch (error) {
      console.error(`❌ Failed to create reward ${reward.name}:`, error)
    }
  }

  console.log(`\n🎉 Seed complete! Created ${createdCount}/${sampleRewards.length} rewards`)
  console.log(`   - ${sampleRewards.filter((r) => r.rarity === 'common').length} common`)
  console.log(`   - ${sampleRewards.filter((r) => r.rarity === 'rare').length} rare`)
  console.log(`   - ${sampleRewards.filter((r) => r.rarity === 'legendary').length} legendary`)
}

seedRewards()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Seed failed:', error)
    process.exit(1)
  })
