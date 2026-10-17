# Baby Buddy

Bring the baby care log of your [Baby Buddy](https://docs.baby-buddy.net)
into Gladys: how long since the last feeding and the last diaper, whether the
baby sleeps, how much sleep today. A button by the cot notes a diaper or
starts and stops the sleep or feeding timer, a scene reminds you when a
feeding is late.

> **Feedback welcome.** This integration was tested against a real Baby Buddy
> server (Docker image `lscr.io/linuxserver/babybuddy`, October 2026), not yet
> with a real Gladys in everyday use. If something does not work as described,
> please say so on the [Gladys forum](https://community.gladysassistant.com)
> or in the [issues](https://github.com/guim31/gladys-babybuddy/issues).

## What you need

- Gladys Assistant 5.1.0 or later.
- A **self-hosted Baby Buddy**, reachable from Gladys (the Docker image listens
  on port 8000).
- The **API key** of a Baby Buddy user: in Baby Buddy, open the user menu (top
  right) → **API key**, and copy the 40 characters. Entries written from Gladys
  are written as this user.

## Set up

1. In Gladys, **Integrations** → install **Baby Buddy**.
2. In the **Configuration** screen, fill in:
   - **Address**: the address of Baby Buddy, for example
     `http://192.168.1.20:8000`, or `https://baby.example.org` behind a reverse
     proxy (a path prefix such as `/babybuddy` is kept);
   - **API key**: the key of your Baby Buddy user.
3. Options:
   - **Type** and **Method of a feeding stopped from Gladys**: Baby Buddy needs
     both to record a feeding; they are used when a feeding timer is stopped
     from Gladys (breast milk, both breasts by default). Fix an entry in Baby
     Buddy afterwards if needed;
   - **Weight unit** and **Temperature unit**: Baby Buddy stores numbers
     without unit, say which ones you use (kilograms and Celsius by default);
   - **Accept self-signed certificates**: for an `https://` address with a
     self-signed certificate, on your own server only;
   - **Refresh interval**: 1, 2 or 5 minutes (1 by default). The minute
     counters move every minute whatever the interval;
   - **Language of the feature names**: the names given to the features when a
     device is added (French by default), the names of the timers started from
     Gladys, and the texts sent to scenes.
4. Save, then **Test the connection**: it reads Baby Buddy and gives the number
   of children and running timers.
5. In the **Discovery** tab, add the devices: one per child.

## Devices

**Baby Buddy _first name_**, one per child, with these features:

| Feature                    | What it says                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| `Since last feeding`       | minutes since the end of the last feeding                          |
| `Feedings today`           | feedings started today                                             |
| `Feeding in progress`      | 1 while a feeding timer runs                                       |
| `Since last diaper change` | minutes since the last diaper change                               |
| `Diaper changes today`     | diaper changes today                                               |
| `Sleeping`                 | 1 while a sleep timer runs                                         |
| `Sleep today`              | minutes of sleep recorded today (since midnight)                   |
| `Temperature`              | the last temperature taken                                         |
| `Weight`                   | the last weight, as text (`4.85 kg`): Gladys has no weight feature |

A **timer** counts as sleep or feeding by its name: the timers started from
Gladys are named `Sleep` and `Feeding` (in the language of the names), and a
timer named, for example, `Nap`, `Sieste`, `Bottle` or `Biberon` in Baby Buddy
counts too. An unnamed timer counts as neither. "Today" is the day in the time
zone of Gladys. The temperature is a "device temperature", so that a child's
37.5 °C does not become the temperature of the nursery in Gladys.

## Dashboard

The **Baby Buddy** widget shows, for one child (the first one, or the one
chosen in the widget settings):

- three tiles: time since the last feeding (`…` while a feeding timer runs),
  since the last diaper, and sleep today;
- the state: asleep since when, feeding in progress or last feeding time, last
  diaper and its kind;
- four buttons: **Wet diaper**, **Dirty diaper**, **Start sleep** / **Woke
  up**, **Start feeding** / **End feeding**. A button does what it says: a
  stale widget never starts a timer it shows as running.

## Scenes

### Triggers

- **No feeding for a while**: fires once per feeding when the chosen number of
  hours (1 to 8) has passed since its end. Filters: the child (empty: any) and
  the number of hours. Nothing fires while a feeding timer runs. Information
  passed on to the actions: the child's first name, the hours, the minutes
  since the last feeding, the end of the last feeding.

When the integration starts, what is already late is known, not news: it fires
for the next hour crossed. After an outage, the hours crossed meanwhile fire
when Baby Buddy answers again.

### Actions

- **Log a diaper change**: writes a wet, dirty, or wet and dirty diaper change
  for a child, now. Results: the child's first name, the kind.
- **Sleep or feeding timer**: starts, stops, or toggles (starts if stopped,
  stops if running) the sleep or feeding timer of a child. Stopped, the timer
  becomes a sleep or feeding entry in Baby Buddy, from its start to now.
  Starting a running timer, or stopping none, changes nothing. Results: the
  child's first name, whether the timer runs, the duration recorded (minutes).

### Scene ideas

- A Zigbee button by the cot: one press runs **Sleep or feeding timer** with
  _Sleep_ and _Start or stop_; a double press runs **Log a diaper change**
  with _Wet_.
- **No feeding for a while** with 3 hours, at night: a soft light in the
  bedroom and a message on the phone.
- When `Sleeping` turns to 1: dim the nursery light and switch the white noise
  speaker on; when it turns to 0, open the blinds a little.

## Troubleshooting

- **"Baby Buddy does not answer"**: check the address and the port from the
  Gladys machine (`http://<address>:8000` opens Baby Buddy in a browser).
- **"API key refused"**: copy the key again from the user menu of Baby Buddy
  (it changes if regenerated).
- **"No Baby Buddy API at this address"**: something answers, but not Baby
  Buddy: check the port, or the path prefix behind a reverse proxy.
- **"The address redirects"**: enter the `https://` address.
- **"Another entry already covers this time"**: Baby Buddy refuses two
  feedings (or two sleeps) at the same time. The timer is kept: fix the
  entries in Baby Buddy, then stop the timer again.
- **A timer is not seen as sleep or feeding**: give it a name with the word
  (`Sleep`, `Nap`, `Feeding`, `Bottle`, or their French, German or Spanish
  equivalents).
- Logs: `LOG_LEVEL=debug` on the container shows every reading.

## Limits

- Baby Buddy is read every 1 to 5 minutes: an entry written in Baby Buddy shows
  up in Gladys within that delay. Each reading makes 2 requests, plus 5 per
  child.
- The integration reads the last 50 entries of each kind per child: enough for
  a day. Pumping, tummy time, medication, notes and measures other than weight
  and temperature are not read.
- It writes only diaper changes and sleep and feeding timers; it never edits or
  deletes an entry.
- The "No feeding for a while" trigger is kept in memory: an hour crossed while
  the integration is stopped is not announced afterwards.
- Gladys keeps no Baby Buddy data in the container (`/data` stays empty).
- Not affiliated with Baby Buddy.
