import { z } from 'zod';
import component from './index';

const paramsSchema = z.object({
  text: z.string().default('CARVED BY\nWATER'),
  color: z.string().default('#eba61f'),
});

export const config = {
  id: 'yosemite-warp-title',
  component,
  name: 'Yosemite Warp Title',
  category: 'text',
  kind: 'component',
  version: '1.0.0',
  paramsSchema,
};

export default config;
