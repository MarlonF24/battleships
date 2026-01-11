
# PregameWSServerStateMessage


## Properties

Name | Type
------------ | -------------
`numPlayersReady` | number
`selfReady` | boolean

## Example

```typescript
import type { PregameWSServerStateMessage } from ''

// TODO: Update the object below with actual values
const example = {
  "numPlayersReady": null,
  "selfReady": null,
} satisfies PregameWSServerStateMessage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PregameWSServerStateMessage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


