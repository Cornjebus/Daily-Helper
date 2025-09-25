import { POST as CalendarSyncPOST } from '@/app/api/calendar/sync/route'

// Mock Supabase server client
const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }))
}))

// Mock Google Calendar client through our service
jest.mock('@/lib/calendar/service', () => ({
  fetchUpcomingEvents: jest.fn(async () => ([
    { id: 'evt1', summary: 'Standup', start: { dateTime: new Date(Date.now()+60*60*1000).toISOString() }, end: { dateTime: new Date(Date.now()+2*60*60*1000).toISOString() } },
    { id: 'evt2', summary: 'Planning', start: { dateTime: new Date(Date.now()+24*60*60*1000).toISOString() }, end: { dateTime: new Date(Date.now()+25*60*60*1000).toISOString() } },
  ])),
  categorizeEvent: jest.requireActual('@/lib/calendar/service').categorizeEvent,
}))

describe('Calendar Sync route', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'gmail_tokens') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }) })
          })
        }
      }
      if (table === 'feed_items') {
        return {
          upsert: jest.fn().mockResolvedValue({ data: null, error: null })
        }
      }
      return {}
    })
  })
  afterAll(() => { process.env = OLD_ENV })

  test('syncs calendar events into feed_items', async () => {
    const res = await CalendarSyncPOST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.events).toBeGreaterThan(0)
    expect(json.itemsCreated).toBeGreaterThan(0)
  })
})

