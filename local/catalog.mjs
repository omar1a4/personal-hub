import { lecture } from './lecture.mjs';

export const courses = [
  { id: 'algorithms', title: 'Algorithms', icon: 'workflow' },
  { id: 'operating-systems', title: 'Operating Systems', icon: 'cpu' },
  { id: 'ai-course', title: 'AI Course', icon: 'network' },
];

export function seedCatalog(store) {
  for (let number = 1; number <= 13; number++) {
    store.seed(`algorithms-${String(number).padStart(2, '0')}`, 'algorithms', `Lecture ${number}`);
  }
  store.seed('demo', 'demo', 'Binary search demo', [{ id: 'demo-excerpt', kind: 'paragraph', text: lecture.content, sources: [] }]);
}