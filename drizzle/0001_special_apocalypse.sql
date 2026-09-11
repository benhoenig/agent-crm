ALTER TYPE "public"."closing_status" ADD VALUE 'In Progress' BEFORE 'EX';--> statement-breakpoint
ALTER TYPE "public"."closing_status" ADD VALUE 'Failed' BEFORE 'Com. Paid';--> statement-breakpoint
ALTER TYPE "public"."marketing_channel" ADD VALUE 'Propertyhub' BEFORE 'Facebook Organic';