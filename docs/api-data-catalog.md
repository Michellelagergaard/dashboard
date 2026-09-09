# Ungapped data catalogue

This catalogue is the project source of truth for data mapping, dashboard calculations, and privacy controls. It is based on the supplied document **Det der hentes fra APIet 02 09 26**.

## Data received per mailing

- Delivery: recipients, sent, delivered, bounces, failed, inactive.
- Engagement: opens, clicks, click to open rate, conversions, unsubscribes.
- Rates: open, click, click to open, bounce, and unsubscribe rates.
- Subject line: length, words, emoji, question marks, exclamation marks, numbers, colons, capitals, personalisation, and first word.
- Content: link counts, unique links, host names, popular destinations, images, buttons, words, characters, and reading time.
- Context: type, tags, category, sender, lists, segments, journey, and repetitions.
- Timing: date, weekday, time, week, and month in Danish time.

## Recipient sample and other channels

- A reproducible sample of up to 2,000 contacts is reduced to aggregate recipient profiles and engagement measures before output.
- SMS, questionnaires, lists, and segments are included only as approved aggregate results.

## Publication and calculation rules

- Show comparative group rates only after at least four mailings and 20,000 delivered emails.
- Draw monthly rates only after at least 500 delivered emails.
- Merge or hide groups below five people; require at least 25 people in each cross-tab cell.
- Never publish raw contacts, contact IDs, personal links, addresses, phone numbers, or behavioural histories.
- Keep flows separate from editorial send-time analysis.
- Explain that opens are affected by privacy protections and are not the same as reading.

## Dashboard mapping

| Dashboard area | Required data |
| --- | --- |
| Latest mailing | Delivery, engagement, rates, subject and comparable mailings of the same type |
| Clicked stories | Documented link clicks, link placement, destinations and recipient segment |
| Development by type | Weighted delivery, opens and clicks over time |
| Segment analysis | Aggregate results per approved member segment and per story |
| All mailings | Searchable mailing metadata, performance, type, audience and status |
| Flows | Flow name, steps, active recipients, mail volume, engagement, unsubscribes and latest activity |

Fields are shown only when the Ungapped endpoint has supplied them and their definition is documented. Missing fields are labelled as unavailable, never treated as zero.
