export interface Resource {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: "Crisis" | "Clinic" | "Food";
  phone: string;
}

export const localResources: Resource[] = [
  {
    id: 1,
    name: "Oaklawn Psychiatric Center",
    address: "415 E Madison St, South Bend, IN",
    latitude: 41.6791,
    longitude: -86.2427,
    type: "Crisis",
    phone: "574-283-1234",
  },
  {
    id: 2,
    name: "Beacon Memorial Hospital (ER)",
    address: "615 N Michigan St, South Bend, IN",
    latitude: 41.6819,
    longitude: -86.2502,
    type: "Crisis",
    phone: "574-647-1000",
  },
  {
    id: 3,
    name: "Epworth Hospital",
    address: "420 N Niles Ave, South Bend, IN",
    latitude: 41.6785,
    longitude: -86.2415,
    type: "Clinic",
    phone: "574-647-8400",
  },
];
