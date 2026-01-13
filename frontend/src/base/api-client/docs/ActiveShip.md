
# ActiveShip


## Properties

Name | Type
------------ | -------------
`length` | number
`orientation` | [Orientation](Orientation.md)
`headRow` | number
`headCol` | number
`hits` | Array&lt;boolean&gt;

## Example

```typescript
import type { ActiveShip } from ''

// TODO: Update the object below with actual values
const example = {
  "length": null,
  "orientation": null,
  "headRow": null,
  "headCol": null,
  "hits": null,
} satisfies ActiveShip

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ActiveShip
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


