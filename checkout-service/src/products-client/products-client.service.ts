import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { isUUID } from 'class-validator';
import { fromCents, toCents } from '../cart/money';
import { ProductSnapshotSource } from './product.interface';

@Injectable()
export class ProductsClientService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    const configuredUrl = configService
      .get<string>('PRODUCTS_SERVICE_URL')
      ?.trim();
    if (!configuredUrl) {
      throw new Error(
        'PRODUCTS_SERVICE_URL deve ser definida com um valor não vazio',
      );
    }
    this.baseUrl = configuredUrl.replace(/\/+$/, '');
  }

  async getProduct(productId: string): Promise<ProductSnapshotSource> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<unknown>(`${this.baseUrl}/products/${productId}`),
      );
      return this.normalizeProduct(response.data, productId);
    } catch (error: unknown) {
      if (error instanceof UnprocessableEntityException) throw error;
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException('Produto não encontrado');
      }
      throw new ServiceUnavailableException(
        'Products service temporariamente indisponível',
      );
    }
  }

  private normalizeProduct(
    value: unknown,
    requestedId: string,
  ): ProductSnapshotSource {
    if (!value || typeof value !== 'object') this.invalidProduct();
    const product = value as Record<string, unknown>;

    if (
      typeof product.id !== 'string' ||
      !isUUID(product.id) ||
      product.id !== requestedId ||
      typeof product.name !== 'string' ||
      !product.name.trim() ||
      typeof product.stock !== 'number' ||
      !Number.isInteger(product.stock) ||
      typeof product.isActive !== 'boolean' ||
      typeof product.sellerId !== 'string' ||
      !isUUID(product.sellerId) ||
      (typeof product.price !== 'string' && typeof product.price !== 'number')
    ) {
      this.invalidProduct();
    }

    let price = 0;
    try {
      price = fromCents(toCents(product.price));
    } catch {
      this.invalidProduct();
    }

    return {
      id: product.id,
      name: product.name.trim(),
      price,
      stock: product.stock,
      isActive: product.isActive,
      sellerId: product.sellerId,
    };
  }

  private invalidProduct(): never {
    throw new UnprocessableEntityException(
      'Resposta inválida do catálogo de produtos',
    );
  }
}
