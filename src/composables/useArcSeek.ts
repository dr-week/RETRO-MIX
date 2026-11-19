import { computed, ref } from 'vue'

const CENTER = 175
const RADIUS = 152
const START_ANGLE = 60
const ARC_SWEEP = 240
const pointOnArc = (angle: number) => {
  const radians = angle * Math.PI / 180
  return { x: CENTER + RADIUS * Math.cos(radians), y: CENTER + RADIUS * Math.sin(radians) }
}
const ARC_START = pointOnArc(START_ANGLE)
const ARC_END = pointOnArc(START_ANGLE + ARC_SWEEP)
const point = (value: number) => Number(value.toFixed(1))
const ARC_PATH = `M ${point(ARC_START.x)} ${point(ARC_START.y)} A ${RADIUS} ${RADIUS} 0 1 1 ${point(ARC_END.x)} ${point(ARC_END.y)}`
const ARC_LENGTH = 2 * Math.PI * RADIUS * ARC_SWEEP / 360

export function useArcSeek(duration: () => number, progress: () => number, seek: (seconds: number) => void) {
  const ratio = computed(() => duration() > 0 ? Math.min(1, Math.max(0, progress() / duration())) : 0)
  const arcStrokeDashoffset = computed(() => ARC_LENGTH * (1 - ratio.value))
  const arcKnobPos = computed(() => {
    return pointOnArc(START_ANGLE + ARC_SWEEP * ratio.value)
  })
  const dragging = ref(false)

  function seekAt(event: PointerEvent, svg: SVGSVGElement) {
    const box = svg.getBoundingClientRect()
    let angle = Math.atan2(event.clientY - box.top - box.height / 2, event.clientX - box.left - box.width / 2) * 180 / Math.PI
    if (angle < 0) angle += 360
    let relative = angle - START_ANGLE
    if (relative < 0) relative += 360
    const gap = 360 - ARC_SWEEP
    const fraction = relative <= ARC_SWEEP ? relative / ARC_SWEEP : relative > ARC_SWEEP + gap / 2 ? 0 : 1
    seek(Math.max(0, fraction * duration()))
  }

  function onArcPointerDown(event: PointerEvent) {
    const svg = event.currentTarget as SVGSVGElement
    dragging.value = true
    svg.setPointerCapture(event.pointerId)
    seekAt(event, svg)
  }
  function onArcPointerMove(event: PointerEvent) {
    if (dragging.value) seekAt(event, event.currentTarget as SVGSVGElement)
  }
  function onArcPointerUp(event: PointerEvent) {
    dragging.value = false
    const svg = event.currentTarget as SVGSVGElement
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
  }
  return { ARC_LENGTH, ARC_PATH, ARC_START, ARC_END, arcStrokeDashoffset, arcKnobPos, onArcPointerDown, onArcPointerMove, onArcPointerUp }
}
