/** @jsx createElement */
import _ from 'lodash'
import { createElement } from 'elliptical'
import { Command, String, Integer, Decimal, URL, PhoneNumber, EmailAddress, Date, Time, DateTime} from 'lacona-phrases'
import { showNotification } from 'lacona-api'
import fetch from 'node-fetch'

// 

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

    fetch(
      `https://maker.ifttt.com/trigger/${result.event}/with/key/${config.ifttt.key}`,
      {method: 'POST', body: {value1: result.argument}}
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
      const triggers = _.map(config.ifttt.triggers, ({event, argument}) => {
        let ArgumentElement = argumentTypeMap[argument]
        let argumentAddition = ArgumentElement
          ? [<literal text=' with ' />, (
            <placeholder label='argument' suppressEmpty={false} id='argument'>
              <ArgumentElement />
            </placeholder>
          )] : null

        return (
          <sequence>
            <placeholder argument='IFTTT event' id='event' suppressEmpty={false}>
              <literal text={event} value={event} />
            </placeholder>
            {argumentAddition}
          </sequence>
        )
      })

      return (
        <sequence>
          <literal text='trigger ' />
          <choice merge>{triggers}</choice>
        </sequence>
      )
    }
  }
}

export const extensions = [IFTTTCommand]
