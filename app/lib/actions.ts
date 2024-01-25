'use server';

import { z } from 'zod';
import clientPromise from './mongodb';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  try {
    const validatedFields = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });

    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
      };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('invoices');
    await collection.insertOne({
      customer_id: customerId,
      amount: amountInCents,
      status: status,
      date: date,
    });
  } catch (error) {
    console.log('Server Error:', error);
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
  try {
    const validatedFields = UpdateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });

    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Update Invoice.',
      };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('invoices');
    const result = await collection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          customer_id: customerId,
          amount: amountInCents,
          status: status,
          date: date,
        },
      },
    );
  } catch (error) {
    console.log('Server Error:', error);
    return {
      message: 'Database Error: Failed to Update Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoiceWithID(id: string) {
  try {
    const invoiceId = new ObjectId(id);

    const mongoClient = await clientPromise;
    const db = mongoClient.db('dashboard');
    const collection = db.collection('invoices');
    await collection.deleteOne({ _id: invoiceId });
  } catch (error) {
    console.log('Server Error:', error);
    return {
      message: 'Database Error: Failed to Delete Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
