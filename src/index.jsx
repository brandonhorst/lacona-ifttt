/** @jsx createElement */
import _ from 'lodash'
import { createElement } from 'elliptical'
import { Command, String, Integer, Decimal, URL, PhoneNumber, EmailAddress, Date, Time, DateTime} from 'lacona-phrases'
import { showNotification, runApplescript } from 'lacona-api'
import { join } from 'path'
import fetch from 'node-fetch'

const IFTTT_IMG = join(__dirname, '../img/IFTTT Logo.png')

function getElement (type, id) {
  switch (type) {
    case 'string': return <String splitOn={/\s/} limit={1} id={id} />
    case 'integer': return <Integer limit={1} id={id} />
    case 'decimal': return <Decimal limit={1} id={id} />
    case 'url': return <URL id={id} />
    case 'phone': return <PhoneNumber id={id} />
    case 'email': return <EmailAddress id={id} />
    case 'date': return <Date past={false} id={id} />
    case 'time': return <Time past={false} id={id} />
    case 'datetime': return <DateTime past={false} id={id} />
  }
}

function commandToElement ({command, event}) {
  const tokenRegex = /(\{string\}|\{integer\}|\{decimal\}|\{url\}|\{phone\}|\{email\}|\{date\}|\{time\}|\{datetime\}|\[.*?,.*?\])/
  const tokenized = command.split(tokenRegex)
  let eventNumber = 1

  const elements = _.map(tokenized, token => {
    if (!token) return null

    if (_.startsWith(token, '{') && _.endsWith(token, '}')) {
      const type = token.slice(1, -1)
      const id = `value${eventNumber}`
      const element = getElement(type, id)

      eventNumber += 1
      
      return element

    } else if (_.startsWith(token, '[') && _.endsWith(token, ']')) {
      const csv = token.slice(1, -1)
      const items = _.chain(csv)
        .split(',')
        .filter()
        .map(text => ({text, value: text}))
        .value()
      const id = `value${eventNumber}`
      eventNumber += 1
      return (
        <placeholder suppressEmpty={false} argument='option' id={id}>
          <list items={items} />
        </placeholder>
      )
    } else {
      return <literal text={token} />
    }
  })

  return (
    <sequence>
      <literal text='' id='event' value={event}/>
      {elements}
    </sequence>
  )
}


const IFTTTCommand = {
  extends: [Command],

  execute (result, {config}) {

    const event = encodeURIComponent(result.event)
    console.log(`https://maker.ifttt.com/trigger/${event}/with/key/${config.key}`)
    fetch(
      `https://maker.ifttt.com/trigger/${event}/with/key/${config.key}`, {
        method: 'POST',
        body: JSON.stringify({
          value1: result.value1,
          value2: result.value2,
          value3: result.value3
        }),
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
      const commands = _.chain(config.commands)
        .filter(command => command.command && command.event)
        .map(commandToElement)
        .value()

      return <choice>{commands}</choice>

      // const triggers = _.chain(config.triggers)
      //   .filter('event')
      //   .map(({event, argument}) => {
      //     let ArgumentElement = argumentTypeMap[argument]
      //     let argumentAddition = ArgumentElement
      //       ? [<literal text=' with ' />, (
      //         <placeholder label='argument' suppressEmpty={false} id='argument'>
      //           <ArgumentElement />
      //         </placeholder>
      //       )] : null

      //     return (
      //       <sequence>
      //         <placeholder argument='IFTTT event' id='event' suppressEmpty={false} annotation={{type: 'image', value: IFTTT_IMG}}>
      //           <literal text={event} value={event} />
      //         </placeholder>
      //         {argumentAddition}
      //       </sequence>
      //     )
      //   }).value()

      // return (
      //   <sequence>
      //     <list items={['trigger ', 'do ', 'activate ']} limit={1} />
      //     <choice merge>{triggers}</choice>
      //   </sequence>
      // )
    }
  }
}

// const VALID_ARGUMENTS = {
//   none: '',
//   string: 'a String',
//   integer: 'an Integer',
//   decimal: 'a Decimal',
//   url: 'a URL',
//   email: 'an Email Address',
//   phone: 'a Phone Number',
//   time: 'a Time',
//   date: 'a Date',
//   datetime: 'a Date and Time'
// }

async function onURLCommand (command, query, {config, setConfig}) {
  if (command !== 'add') {
    console.error('lacona-ifttt command not recognized. URL should be in the form https://lacona-ifttt/add?event=x&command=y')
    return
  }
  if (!query.event) {
    console.error('lacona-ifttt/add event was not provided. URL should be in the form https://lacona-ifttt/add?event=x&command=y')
    return 
  }
  if (!query.command) {
    console.error('lacona-ifttt/add invalid command. URL should be in the form https://lacona-ifttt/add?event=x&command=y')
    return
  }

  if (_.find(config.triggers, trigger => trigger.event === query.event && trigger.command === query.command)) {
    const text = `This IFTTT command is already set up in Lacona.`
    const textEscaped = text.replace(/"/g, '\\"')
    await runApplescript({script: `display dialog "${textEscaped}" buttons {"OK"}`})
    return
  }

  // if we made it this far
  // const argumentText = (query.argument && query.argument !== 'none')
  //   ? ` with ${VALID_ARGUMENTS[query.argument]} argument?`
  //   : '?'
  const newEntry = `Would you like to create a Lacona IFTTT command "${query.command}" which triggers the "${query.event}" event?`
  const newEntryEscaped = newEntry.replace(/"/g, '\\"')

  const response = await runApplescript({script: `
    set question to display dialog "${newEntryEscaped}" buttons {"Yes", "No"} default button 2
    return button returned of question
  `})
  if (response === 'Yes') {
    const newConfig = _.cloneDeep(config)
    newConfig.commands.push({event: query.event, command: query.command})
    setConfig(newConfig)
  }
}

export const extensions = [IFTTTCommand]
export const hooks = {onURLCommand}
