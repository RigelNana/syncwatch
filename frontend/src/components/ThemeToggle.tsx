import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/theme'
import { motion } from 'framer-motion'

export function ThemeToggle() {
  const { dark, toggle } = useThemeStore()

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggle}
      className="relative h-10 w-10 rounded-xl glass glass-hover flex items-center justify-center"
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{ rotate: dark ? 0 : 180, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {dark ? (
          <Moon className="h-4 w-4 text-violet-400" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </motion.div>
    </motion.button>
  )
}
