import ItineraryMap, { Stop } from './ItineraryMap';

const sfStops: Stop[] = [
  {
    name: 'Moscone Center South',
    lat: 37.7836044,
    lng: -122.4008882,
    arrivalTime: '8:30 AM',
    notes: 'Replay 2026 venue.',
  },
  {
    name: 'Ferry Building Marketplace',
    lat: 37.7954425,
    lng: -122.3936136,
    arrivalTime: '9:00 AM',
    durationMinutes: 60,
    notes: 'Walk here (~15 min) for breakfast.',
  },
  {
    name: 'PIER 39',
    lat: 37.808673,
    lng: -122.409821,
    arrivalTime: '10:15 AM',
    durationMinutes: 45,
    notes: 'Sea lions, clam chowder, touristy fun.',
  },
  {
    name: 'Palace of Fine Arts',
    lat: 37.8029308,
    lng: -122.4484231,
    arrivalTime: '11:30 AM',
    durationMinutes: 20,
  },
  {
    name: 'Golden Gate Bridge Welcome Center',
    lat: 37.8077973,
    lng: -122.4748473,
    arrivalTime: '12:00 PM',
    durationMinutes: 45,
    notes: 'Viewpoint 1 — close-up from SF side.',
  },
  {
    name: 'Baker Beach',
    lat: 37.794367,
    lng: -122.4826588,
    arrivalTime: '1:00 PM',
    durationMinutes: 30,
    notes: 'Viewpoint 2 — bridge framed by headlands.',
  },
  {
    name: 'Battery Spencer',
    lat: 37.827761,
    lng: -122.4816692,
    arrivalTime: '1:45 PM',
    durationMinutes: 45,
    notes: 'Viewpoint 3 — the postcard shot.',
  },
  {
    name: 'Lombard Street',
    lat: 37.8020179,
    lng: -122.4195579,
    arrivalTime: '3:00 PM',
    durationMinutes: 15,
  },
];

export default function SFTrip() {
  return (
    <div>
      <h1>SF Day Trip</h1>
      <ItineraryMap stops={sfStops} showRoute={true} height="600px" />
    </div>
  );
}
