export type Theme = {
  personaName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
    surface: string;
    tertiary: string;
    border: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  iconography: {
    pattern: string;
  };
};
