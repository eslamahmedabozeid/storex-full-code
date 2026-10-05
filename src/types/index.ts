export interface Product {
  id: string;
  name: string;
  brand: string;
  unit: string;
  price: number;
  originalPrice?: number;
  image: string;
  categoryId: string;
  badge?: 'deal' | 'fresh' | 'sale' | 'new' | 'bestseller';
  rating: number;
  reviewCount: number;
  description?: string;
  inStock: boolean;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  subcategories?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Deal {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  endTime: string;
  discount: string;
}

export type Page = 'home' | 'category' | 'checkout' | 'orderConfirmation';

export type Tab = 'home' | 'search' | 'deals' | 'cart' | 'account';
