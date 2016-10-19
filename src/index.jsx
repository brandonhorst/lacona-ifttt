/** @jsx createElement */
import _ from 'lodash'
import { createElement } from 'elliptical'
import { Command, String, Integer, Decimal, URL, PhoneNumber, EmailAddress, Date, Time, DateTime} from 'lacona-phrases'
import { showNotification } from 'lacona-api'
import { join } from 'path'
import fetch from 'node-fetch'

const IFTTT_IMG = join(__dirname, '../img/IFTTT Logo.png')

const argumentTypeMap = {
  string: String,
  integer: Integer,
  decimal: Decimal,
  url: URL,
  phone: PhoneNumber,
  email: EmailAddress,
  date: Date,
  time: Time,
  datetime: DateTime,
  none: null
}

const IFTTTCommand = {
  extends: [Command],

  execute (result, {config}) {
    const event = encodeURIComponent(result.event)
    fetch(
      `https://maker.ifttt.com/trigger/${event}/with/key/${config.ifttt.key}`, {
        method: 'POST',
        body: JSON.stringify({value1: result.argument}),
        headers: {'Content-Type': 'application/json'}
      }
    ).then(res => {
      if (res.ok) {
        showNotification({title: 'IFTTT', subtitle: `${result.event} event triggered successfully`})
      } else {
        showNotification({title: 'IFTTT Error', subtitle: `An error occurred triggering ${result.event}`, content: 'Check your IFTTT Key setting'})
        console.error('IFTTT returned error', res.status, res.statusText)
      }
    }).catch(err => {
      showNotification({title: 'IFTTT Error', subtitle: 'IFTTT could not be reached', content: 'Check your network settings'})
        console.error('IFTTT network error', err)
    })
  },

  describe ({config}) {
    if (config.ifttt.key) {
      const triggers = _.chain(config.ifttt.triggers)
        .filter('event')
        .map(({event, argument}) => {
          let ArgumentElement = argumentTypeMap[argument]
          let argumentAddition = ArgumentElement
            ? [<literal text=' with ' />, (
              <placeholder label='argument' suppressEmpty={false} id='argument'>
                <ArgumentElement />
              </placeholder>
            )] : null

          return (
            <sequence>
              <placeholder argument='IFTTT event' id='event' suppressEmpty={false} annotation={{type: 'image', value: IFTTT_IMG}}>
                <literal text={event} value={event} />
              </placeholder>
              {argumentAddition}
            </sequence>
          )
        }).value()

      return (
        <sequence>
          <list items={['trigger ', 'do ', 'activate ']} limit={1} />
          <choice merge>{triggers}</choice>
        </sequence>
      )
    }
  }
}

export const extensions = [IFTTTCommand]
