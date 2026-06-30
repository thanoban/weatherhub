export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type ResolvedLocation = Coordinates & {
  name: string;
  country?: string;
  state?: string;
};

export type CurrentWeather = {
  temperature: number;
  apparentTemperature: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  precipitation: number;
  isDay: boolean;
  weatherCode: number;
  time: string;
};

export type ForecastDay = {
  date: string;
  min: number;
  max: number;
  precipitationChance: number;
  weatherCode: number;
};

export type LiveWeatherResponse = {
  location: ResolvedLocation;
  current: CurrentWeather;
  forecast: ForecastDay[];
  mapUrl: string;
};

export type HistoryDay = {
  date: string;
  min: number;
  max: number;
  mean: number;
  precipitationSum: number;
};

export type WeatherRecord = {
  id: string;
  locationQuery: string;
  locationName: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  days: HistoryDay[];
};
