import type { Product, Category, Deal } from '@/types';

export const categories: Category[] = [
  { id: 'food', name: 'Food', image: '/images/cat-food.jpg', subcategories: ['Pasta & Rice', 'Canned Food', 'Sauces', 'Frozen'] },
  { id: 'beverages', name: 'Beverages', image: '/images/cat-beverages.jpg', subcategories: ['Water', 'Soft Drinks', 'Juices', 'Coffee & Tea'] },
  { id: 'fresh', name: 'Fresh Produce', image: '/images/cat-fresh.jpg', subcategories: ['Fruits', 'Vegetables', 'Herbs'] },
  { id: 'dairy', name: 'Dairy & Eggs', image: '/images/cat-dairy.jpg', subcategories: ['Milk', 'Cheese', 'Yogurt', 'Eggs'] },
  { id: 'household', name: 'Household', image: '/images/cat-household.jpg', subcategories: ['Cleaning', 'Laundry', 'Paper'] },
  { id: 'baby', name: 'Baby Care', image: '/images/cat-baby.jpg', subcategories: ['Diapers', 'Food', 'Bath'] },
  { id: 'snacks', name: 'Snacks', image: '/images/cat-snacks.jpg', subcategories: ['Chips', 'Chocolate', 'Nuts'] },
  { id: 'breakfast', name: 'Breakfast', image: '/images/cat-breakfast.jpg', subcategories: ['Cereal', 'Bread', 'Honey', 'Coffee'] },
];

export const products: Product[] = [
  {
    id: 'p1', name: 'Pure Life Water', brand: 'Nestle', unit: '1.5L',
    price: 8.50, originalPrice: 10.00, image: '/images/prod-water.jpg',
    categoryId: 'beverages', badge: 'bestseller', rating: 4.8, reviewCount: 234, inStock: true,
    description: 'Pure and refreshing drinking water, perfect for daily hydration.',
  },
  {
    id: 'p2', name: 'Classic Coffee', brand: 'Nescafe', unit: '200g Jar',
    price: 95.00, originalPrice: 120.00, image: '/images/cat-beverages.jpg',
    categoryId: 'beverages', badge: 'deal', rating: 4.7, reviewCount: 189, inStock: true,
    description: 'Rich and aromatic instant coffee for a perfect start to your day.',
  },
  {
    id: 'p3', name: 'Coca Cola', brand: 'Coca Cola', unit: '1L',
    price: 18.00, image: '/images/cat-beverages.jpg',
    categoryId: 'beverages', badge: 'sale', rating: 4.6, reviewCount: 312, inStock: true,
    description: 'The refreshing taste of Coca Cola.',
  },
  {
    id: 'p4', name: 'Fresh Tomatoes', brand: 'Local Farm', unit: '1kg',
    price: 15.00, image: '/images/cat-fresh.jpg',
    categoryId: 'fresh', badge: 'fresh', rating: 4.5, reviewCount: 98, inStock: true,
    description: 'Farm-fresh red tomatoes, perfect for salads and cooking.',
  },
  {
    id: 'p5', name: 'Baladi Bread', brand: 'Local Bakery', unit: '5 pcs',
    price: 7.50, image: '/images/cat-food.jpg',
    categoryId: 'food', badge: 'fresh', rating: 4.9, reviewCount: 567, inStock: true,
    description: 'Traditional Egyptian baladi bread, baked fresh daily.',
  },
  {
    id: 'p6', name: 'Orange Juice', brand: 'Juhayna', unit: '1L',
    price: 28.00, originalPrice: 32.00, image: '/images/cat-beverages.jpg',
    categoryId: 'beverages', badge: 'deal', rating: 4.7, reviewCount: 145, inStock: true,
    description: '100% pure orange juice, no added sugar.',
  },
  {
    id: 'p7', name: 'Baby Dry Diapers', brand: 'Pampers', unit: 'Size 4, 64pcs',
    price: 245.00, originalPrice: 290.00, image: '/images/cat-baby.jpg',
    categoryId: 'baby', badge: 'deal', rating: 4.8, reviewCount: 423, inStock: true,
    description: 'Up to 12 hours of overnight protection.',
  },
  {
    id: 'p8', name: 'Fresh Milk', brand: 'Almarai', unit: '1L',
    price: 22.00, image: '/images/cat-dairy.jpg',
    categoryId: 'dairy', badge: 'fresh', rating: 4.6, reviewCount: 201, inStock: true,
    description: '100% pure fresh cow milk.',
  },
  {
    id: 'p9', name: 'Dairy Milk Chocolate', brand: 'Cadbury', unit: '160g',
    price: 42.00, image: '/images/cat-snacks.jpg',
    categoryId: 'snacks', badge: 'bestseller', rating: 4.9, reviewCount: 678, inStock: true,
    description: 'Creamy milk chocolate made with a glass and a half of fresh milk.',
  },
  {
    id: 'p10', name: 'Laundry Detergent', brand: 'Tide', unit: '2.5kg',
    price: 185.00, originalPrice: 210.00, image: '/images/cat-household.jpg',
    categoryId: 'household', badge: 'sale', rating: 4.5, reviewCount: 156, inStock: true,
    description: 'Powerful cleaning for all your laundry needs.',
  },
  {
    id: 'p11', name: 'Brown Eggs', brand: 'Local Farm', unit: '30 pcs',
    price: 68.00, image: '/images/cat-dairy.jpg',
    categoryId: 'dairy', badge: 'fresh', rating: 4.7, reviewCount: 189, inStock: true,
    description: 'Farm-fresh brown eggs.',
  },
  {
    id: 'p12', name: 'Yellow Label Tea', brand: 'Lipton', unit: '100 bags',
    price: 55.00, image: '/images/cat-breakfast.jpg',
    categoryId: 'breakfast', badge: 'bestseller', rating: 4.6, reviewCount: 334, inStock: true,
    description: 'Fine black tea with a rich taste and aroma.',
  },
];

export const buyAgainProducts: Product[] = [products[0], products[4], products[6], products[7], products[8], products[11]];

export const trendingProducts: Product[] = [products[0], products[3], products[4], products[6], products[8], products[11], products[1], products[9]];

export const deals: Deal[] = [
  {
    id: 'd1', title: 'Ramadan Family Pack', subtitle: 'Save 25% on essentials', image: '/images/banner-ramadan.jpg',
    endTime: '2026-05-15T23:59:00', discount: '25%',
  },
  {
    id: 'd2', title: 'Free Delivery', subtitle: 'On orders over 200 EGP', image: '/images/banner-delivery.jpg',
    endTime: '2026-05-31T23:59:00', discount: 'FREE',
  },
  {
    id: 'd3', title: 'Fresh Veggie Deal', subtitle: 'Up to 30% off produce', image: '/images/banner-fresh.jpg',
    endTime: '2026-05-14T23:59:00', discount: '30%',
  },
  {
    id: 'd4', title: 'Baby Care Week', subtitle: '20% off all baby products', image: '/images/cat-baby.jpg',
    endTime: '2026-05-20T23:59:00', discount: '20%',
  },
];

export const FREE_DELIVERY_THRESHOLD = 200;
export const DELIVERY_FEE = 25;
