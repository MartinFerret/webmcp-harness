// The bookSlot WebMCP tool: the app tells agents what it can do, instead of
// letting them guess from the UI.
// Angular's experimental WebMCP API: https://angular.dev/ai/webmcp
// The browser API underneath:         https://developer.chrome.com/docs/ai/webmcp/imperative-api
import { inject, provideExperimentalWebMcpTools } from '@angular/core';
import { Api } from './api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const provideBookSlotTool = () =>
  provideExperimentalWebMcpTools([
    {
      name: 'bookSlot',
      description: 'Book a slot in the calendar for a person. Returns whether the booking was really made.',
      inputSchema: {
        type: 'object',
        properties: {
          person: { type: 'string', description: 'Name of the person the slot is for' },
          day: { type: 'string', enum: DAYS },
          time: { type: 'string', description: '24-hour time, e.g. 09:00' },
        },
        required: ['person', 'day', 'time'],
        additionalProperties: false,
      },
      async execute({ person, day, time }) {
        // The schema is only a hint for the agent: validate for real here.
        if (typeof person !== 'string' || !person.trim()) return 'Not booked: person is required.';
        if (!DAYS.includes(day)) return `Not booked: day must be one of ${DAYS.join(', ')}.`;
        if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return 'Not booked: time must look like 14:00.';

        // The same API call as the "Book" button, but the answer is reported honestly.
        const error = await inject(Api).book(day, time, person.trim());
        return error ? `Not booked: ${error}.` : `Booked ${day} ${time} for ${person.trim()}.`;
      },
    },
  ]);
