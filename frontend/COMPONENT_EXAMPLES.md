# BlurText Component - Usage Examples

## Basic Usage

### Example 1: Simple Text Animation
```tsx
import { BlurText } from '@/components/ui/animated-blur-text'

export default function SimpleExample() {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <BlurText
        text="Welcome to Order"
        className="text-5xl font-bold text-white"
      />
    </div>
  )
}
```

### Example 2: Words vs Letters Animation
```tsx
// Word-by-word animation
<BlurText
  text="Animate by words"
  animateBy="words"
  delay={150}
  className="text-3xl text-blue-400"
/>

// Letter-by-letter animation
<BlurText
  text="Animate by letters"
  animateBy="letters"
  delay={50}
  className="text-3xl text-blue-400"
/>
```

### Example 3: Direction Control
```tsx
// Animate from top
<BlurText
  text="From top"
  direction="top"
  className="text-3xl text-white"
/>

// Animate from bottom
<BlurText
  text="From bottom"
  direction="bottom"
  className="text-3xl text-white"
/>
```

### Example 4: Customized Timing
```tsx
<BlurText
  text="Fast animation"
  delay={50}           // Shorter delay between elements
  stepDuration={0.2}   // Faster individual animation
  className="text-3xl text-white"
/>

<BlurText
  text="Slow animation"
  delay={300}          // Longer delay between elements
  stepDuration={1}     // Slower individual animation
  className="text-3xl text-white"
/>
```

### Example 5: Custom Styling
```tsx
<BlurText
  text="Rainbow gradient"
  className="text-4xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent"
/>

<BlurText
  text="Glowing text"
  className="text-4xl font-bold text-blue-400 drop-shadow-lg shadow-blue-500/50"
/>
```

### Example 6: Animation Completion Callback
```tsx
const [animationDone, setAnimationDone] = useState(false)

<BlurText
  text="Callback example"
  onAnimationComplete={() => {
    setAnimationDone(true)
    console.log('Animation completed!')
  }}
  className="text-3xl text-white"
/>

{animationDone && <p>Animation is done!</p>}
```

### Example 7: Multi-Line Text
```tsx
<div className="flex flex-col gap-4">
  <BlurText
    text="First line"
    className="text-2xl text-white"
  />
  <BlurText
    text="Second line"
    className="text-2xl text-white"
    delay={200}
  />
  <BlurText
    text="Third line"
    className="text-2xl text-white"
    delay={400}
  />
</div>
```

### Example 8: Custom Animation State
```tsx
<BlurText
  text="Custom animation"
  animationFrom={{ filter: "blur(20px)", opacity: 0, y: -100 }}
  animationTo={[
    { filter: "blur(10px)", opacity: 0.5, y: -50 },
    { filter: "blur(0px)", opacity: 1, y: 0 }
  ]}
  className="text-3xl text-white"
/>
```

## Advanced Patterns

### Pattern 1: Hero Section
```tsx
export default function HeroSection() {
  return (
    <section className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-black via-blue-900 to-black">
      <div className="text-center space-y-4">
        <BlurText
          text="Create"
          className="text-3xl text-blue-300 font-light"
        />
        <BlurText
          text="ORDER"
          className="text-8xl font-black text-blue-500"
          delay={100}
          stepDuration={0.5}
        />
        <BlurText
          text="Revolutionize your workflow"
          className="text-xl text-gray-300 font-light"
          delay={50}
        />
      </div>
    </section>
  )
}
```

### Pattern 2: Feature Cards
```tsx
export default function FeatureCards() {
  const features = [
    { title: "Fast", desc: "Lightning quick animations" },
    { title: "Smooth", desc: "Buttery smooth blur effects" },
    { title: "Flexible", desc: "Fully customizable options" }
  ]

  return (
    <div className="grid grid-cols-3 gap-4 p-8">
      {features.map((feature, i) => (
        <div key={i} className="border border-blue-500 p-4 rounded-lg">
          <BlurText
            text={feature.title}
            className="text-2xl font-bold text-blue-400 mb-2"
            delay={100 * i}
          />
          <p className="text-gray-400">{feature.desc}</p>
        </div>
      ))}
    </div>
  )
}
```

### Pattern 3: Interactive Trigger
```tsx
'use client'

import { useState } from 'react'
import { BlurText } from '@/components/ui/animated-blur-text'

export default function InteractiveTrigger() {
  const [showAnimation, setShowAnimation] = useState(false)

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-8">
      <button
        onClick={() => setShowAnimation(!showAnimation)}
        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
      >
        {showAnimation ? 'Hide' : 'Show'} Animation
      </button>

      {showAnimation && (
        <BlurText
          text="Triggered animation"
          className="text-5xl font-bold text-white"
        />
      )}
    </div>
  )
}
```

### Pattern 4: Text Stream
```tsx
export default function TextStream() {
  const texts = [
    "Stream line one",
    "Stream line two",
    "Stream line three",
    "Stream line four"
  ]

  return (
    <div className="space-y-8 p-8">
      {texts.map((text, i) => (
        <BlurText
          key={i}
          text={text}
          className="text-2xl text-white"
          delay={100}
          threshold={0}
        />
      ))}
    </div>
  )
}
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | `""` | Text to animate |
| `delay` | number | `200` | Delay between elements (ms) |
| `className` | string | `""` | Tailwind CSS classes |
| `animateBy` | "words" \| "letters" | `"words"` | Animation granularity |
| `direction` | "top" \| "bottom" | `"top"` | Animation direction |
| `threshold` | number | `0.1` | Intersection observer threshold |
| `rootMargin` | string | `"0px"` | Intersection observer margin |
| `animationFrom` | Record<string, any> | auto | Custom initial state |
| `animationTo` | Record<string, any>[] | auto | Custom animation frames |
| `easing` | (t: number) => number | `t => t` | Custom easing function |
| `onAnimationComplete` | () => void | - | Completion callback |
| `stepDuration` | number | `0.35` | Duration per animation step (s) |

## Performance Tips

1. **Limit Text Length**: Shorter texts animate faster
2. **Use Word Animation**: Faster than letter animation
3. **Increase Delays**: Spread out animations to reduce visual clutter
4. **Lazy Load**: Use Intersection Observer threshold appropriately
5. **Memoize Props**: Use `useMemo` for expensive calculations

## Common Issues & Solutions

### Issue: Animation doesn't trigger
**Solution**: Ensure the component is visible in viewport when page loads. Use `threshold: 0` if needed.

### Issue: Animation is too fast/slow
**Solution**: Adjust `delay` and `stepDuration` props.

### Issue: Text overlaps
**Solution**: Add appropriate margins/spacing via `className`.

### Issue: Performance lag
**Solution**: Use `animateBy="words"` instead of `"letters"` for longer text.

---

For more information, see [BLUR_TEXT_INTEGRATION.md](./BLUR_TEXT_INTEGRATION.md)
