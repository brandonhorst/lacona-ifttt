/** @jsx createElement */
import _ from 'lodash'
import { createElement } from 'elliptical'
import { Command, String, Integer, Decimal, URL, PhoneNumber, EmailAddress, Date, Time, DateTime} from 'lacona-phrases'
import { showNotification, runApplescript } from 'lacona-api'
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
      `https://maker.ifttt.com/trigger/${event}/with/key/${config.key}`, {
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
    if (config.key) {
      const triggers = _.chain(config.triggers)
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

const VALID_ARGUMENTS = {
  none: '',
  string: 'a String',
  integer: 'an Integer',
  decimal: 'a Decimal',
  url: 'a URL',
  email: 'an Email Address',
  phone: 'a Phone Number',
  time: 'a Time',
  date: 'a Date',
  datetime: 'a Date and Time'
}

async function onURLCommand (command, query, {config, setConfig}) {
  if (command !== 'add-trigger') {
    console.error('lacona-ifttt command not recognized. URL should be in the form https://lacona-ifttt/add-trigger?event=x')
    return
  }
  if (!query.event) {
    console.error('lacona-ifttt/add-trigger event was not provided. URL should be in the form https://lacona-ifttt/add-trigger?event=x')
    return 
  }
  if (query.argument && !_.includes(_.keys(VALID_ARGUMENTS), query.argument)) {
    console.error('lacona-ifttt/add-trigger invalid argument type')
    return
  }

  if (_.find(config.triggers, trigger => trigger.event === query.event && trigger.argument === (query.argument || 'none'))) {
    const text = `Lacona already has a trigger called ${query.event}. Check the IFTTT Addon preferences.`
    const textEscaped = text.replace(/"/g, '\\"')
    await runApplescript({script: `display dialog "${textEscaped}" buttons {"OK"}`})
    return
  }

  // if we made it this far
  const argumentText = (query.argument && query.argument !== 'none')
    ? ` with ${VALID_ARGUMENTS[query.argument]} argument?`
    : '?'
  const newEntry = `Would you like to add a Lacona IFTTT trigger called "${query.event}"${argumentText}`
  const newEntryEscaped = newEntry.replace(/"/g, '\\"')

  const response = await runApplescript({script: `
    set question to display dialog "${newEntryEscaped}" buttons {"Yes", "No"} default button 2
    return button returned of question
  `})
  if (response === 'Yes') {
    const newConfig = _.cloneDeep(config)
    newConfig.triggers.push({event: query.event, argument: query.argument || 'none'})
  console.log("RES", newConfig)
    setConfig(newConfig)
  }
}

export const extensions = [IFTTTCommand]
export const hooks = {onURLCommand}
