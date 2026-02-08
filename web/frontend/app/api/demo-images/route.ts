import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface DemoImage {
  url: string
  gender: 'man' | 'woman' | 'other'
}

function naturalSort(a: DemoImage, b: DemoImage): number {
  const numA = parseInt(a.url.match(/_(\d+)\./)?.[1] || '0')
  const numB = parseInt(b.url.match(/_(\d+)\./)?.[1] || '0')
  if (a.gender !== b.gender) return a.gender < b.gender ? -1 : 1
  return numA - numB
}

export async function GET() {
  const demoDir = path.join(process.cwd(), 'public', 'demo')

  try {
    const files = fs.readdirSync(demoDir)
    const images: DemoImage[] = files
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map((f) => {
        const lower = f.toLowerCase()
        let gender: 'man' | 'woman' | 'other' = 'other'
        if (lower.startsWith('man_')) gender = 'man'
        else if (lower.startsWith('woman_')) gender = 'woman'
        return { url: `/demo/${f}`, gender }
      })
      .sort(naturalSort)

    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: [] })
  }
}
