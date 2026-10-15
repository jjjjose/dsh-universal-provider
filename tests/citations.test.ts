import { describe, expect, it } from 'vitest'
import { codexCitations } from '../src/core/api/codex-citations.ts'

describe('Codex Citations', () => {
  it('renders inline url citations correctly', () => {
    const text = 'Here is some text \uE200cite\uE2020\uE201 with citation.'
    const rendered = codexCitations.render(text, 0, [
      {
        type: 'url_citation',
        start_index: 18,
        end_index: 26,
        url: 'https://example.com/doc',
        title: 'Example Documentation',
      },
    ])

    expect(rendered).toBe('Here is some text [Example Documentation](<https://example.com/doc>) with citation.')
  })
})
