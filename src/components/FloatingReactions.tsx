import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FloatingReactionsProps {
  trigger: number;
  emoji: string;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  duration: number;
}

export const FloatingReactions: React.FC<FloatingReactionsProps> = ({ trigger, emoji }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Don't animate on initial mount
    if (trigger === 0) return;

    // Generate 4-6 random particles per click
    const newParticles = Array.from({ length: Math.floor(Math.random() * 3) + 4 }).map(() => ({
      id: `particle-${Date.now()}-${Math.random()}`,
      x: (Math.random() - 0.5) * 80, // Drift left/right randomly (-40px to +40px)
      y: -(Math.random() * 60 + 50), // Float UP randomly (-50px to -110px)
      duration: Math.random() * 0.5 + 0.8, // Last between 0.8s and 1.3s
    }));

    setParticles((prev) => [...prev, ...newParticles]);

    // Clean up particles from the DOM after they fade out
    const timeout = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1500);

    return () => clearTimeout(timeout);
  }, [trigger]);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-50">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 0.2, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: 1.5, x: p.x, y: p.y }}
            exit={{ opacity: 0 }}
            transition={{ duration: p.duration, ease: 'easeOut' }}
            className="absolute text-2xl drop-shadow-md select-none"
          >
            {emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
