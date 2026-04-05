import { motion } from 'framer-motion'
import { Download, AlertCircle } from 'lucide-react'

interface DownloadProgressProps {
  progress: number
  status: string
}

export function DownloadProgress({ progress, status }: DownloadProgressProps) {
  if (status === 'ready') return null

  const isError = status === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full aspect-video rounded-2xl overflow-hidden glass flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-6 p-8">
        {isError ? (
          <>
            <AlertCircle className="h-16 w-16 text-red-400" />
            <p className="text-lg font-medium text-red-400">下载失败</p>
            <p className="text-sm text-muted-foreground">请检查视频链接是否有效</p>
          </>
        ) : (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Download className="h-12 w-12 text-violet-400" />
            </motion.div>

            <div className="w-64 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">正在下载视频</span>
                <span className="text-violet-400 font-mono">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                请耐心等待，下载完成后将自动开始播放
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
